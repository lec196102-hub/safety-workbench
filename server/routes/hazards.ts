import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { db } from '../db';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { appConfig, hazardConfig } from '../lib/config';

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), appConfig.server.uploadDir);
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: appConfig.fileLimits.hazardAttachmentMaxSize }, // 10MB
});

// 工具：格式化时间字符串
function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 获取隐患列表（支持筛选）
router.get('/', authMiddleware, (req, res) => {
  const { status, startDate, endDate } = req.query;
  let sql = `
    SELECT h.*,
      (SELECT COUNT(*) FROM attachments a WHERE a.hazard_id = h.id) as attachment_count
    FROM hazards h
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status && status !== 'all') {
    sql += ' AND h.status = ?';
    params.push(status);
  }
  if (startDate) {
    sql += ' AND h.date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND h.date <= ?';
    params.push(endDate);
  }
  sql += ' ORDER BY h.date DESC, h.created_at DESC';

  const rows = db.prepare(sql).all(...params) as any[];
  // 获取所有附件（按隐患ID分组）
  const hazardIds = rows.map((r) => r.id);
  let allAttachments: any[] = [];
  if (hazardIds.length > 0) {
    const placeholders = hazardIds.map(() => '?').join(',');
    allAttachments = db.prepare(
      `SELECT * FROM attachments WHERE hazard_id IN (${placeholders}) ORDER BY upload_time`
    ).all(...hazardIds) as any[];
  }
  const attachmentsByHazard = new Map<string, any[]>();
  for (const att of allAttachments) {
    if (!attachmentsByHazard.has(att.hazard_id)) {
      attachmentsByHazard.set(att.hazard_id, []);
    }
    attachmentsByHazard.get(att.hazard_id)!.push({
      id: att.id,
      name: att.name,
      size: att.size,
      type: att.type,
      url: `/api/hazards/attachments/${att.id}/file`,
      uploadTime: att.upload_time,
    });
  }

  const hazards = rows.map((row) => ({
    id: row.id,
    date: row.date,
    location: row.location,
    description: row.description,
    responsible: row.responsible,
    acceptTime: row.accept_time,
    status: row.status,
    attachments: attachmentsByHazard.get(row.id) ?? [],
  }));
  res.json(hazards);
});

// 获取单条隐患详情（含附件）
router.get('/:id', authMiddleware, (req, res) => {
  const hazard = db.prepare('SELECT * FROM hazards WHERE id = ?').get(req.params.id) as any;
  if (!hazard) {
    res.status(404).json({ error: '隐患不存在' });
    return;
  }
  const attachments = db.prepare('SELECT * FROM attachments WHERE hazard_id = ? ORDER BY upload_time').all(req.params.id) as any[];
  res.json({
    id: hazard.id,
    date: hazard.date,
    location: hazard.location,
    description: hazard.description,
    responsible: hazard.responsible,
    acceptTime: hazard.accept_time,
    status: hazard.status,
    attachments: attachments.map((a) => ({
      id: a.id,
      name: a.name,
      size: a.size,
      type: a.type,
      url: `/api/hazards/attachments/${a.id}/file`,
      uploadTime: a.upload_time,
    })),
  });
});

// 新增隐患
router.post('/', authMiddleware, (req, res) => {
  const { date, location, description, responsible, acceptTime, status } = req.body;
  if (!date || !location || !description || !responsible) {
    res.status(400).json({ error: '请填写完整信息' });
    return;
  }
  // 验收时间可选，留空则存空字符串
  const finalAcceptTime = acceptTime ? acceptTime.trim() : '';
  const id = Date.now().toString();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO hazards (id, date, location, description, responsible, accept_time, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    date,
    location.trim(),
    description.trim(),
    responsible.trim(),
    finalAcceptTime,
    status || 'unfixed',
    req.user!.userId,
    now,
    now,
  );
  res.json({
    id,
    date,
    location: location.trim(),
    description: description.trim(),
    responsible: responsible.trim(),
    acceptTime: finalAcceptTime,
    status: status || 'unfixed',
    attachments: [],
  });
});

// 更新隐患
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const hazard = db.prepare('SELECT * FROM hazards WHERE id = ?').get(id) as any;
  if (!hazard) {
    res.status(404).json({ error: '隐患不存在' });
    return;
  }
  const fields: string[] = [];
  const values: any[] = [];
  const allowed = hazardConfig.updatableFields;
  const fieldMap: Record<string, string> = hazardConfig.dbFieldMap;
  for (const [key, dbKey] of Object.entries(fieldMap)) {
    if (req.body[key] !== undefined) {
      let val = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
      fields.push(`${dbKey} = ?`);
      values.push(val);
    }
  }
  if (fields.length === 0) {
    res.status(400).json({ error: '没有需要更新的字段' });
    return;
  }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  db.prepare(`UPDATE hazards SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM hazards WHERE id = ?').get(id) as any;
  res.json({
    id: updated.id,
    date: updated.date,
    location: updated.location,
    description: updated.description,
    responsible: updated.responsible,
    acceptTime: updated.accept_time,
    status: updated.status,
  });
});

// 切换状态（所有登录用户可用？不，按需求子账号只能新增不能编辑/删除已有）
router.post('/:id/status', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!Object.values(hazardConfig.statusValues).includes(status)) {
    res.status(400).json({ error: '无效状态' });
    return;
  }
  const hazard = db.prepare('SELECT * FROM hazards WHERE id = ?').get(id) as any;
  if (!hazard) {
    res.status(404).json({ error: '隐患不存在' });
    return;
  }
  db.prepare('UPDATE hazards SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
  res.json({ id, status });
});

// 删除隐患（仅管理员）
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const hazard = db.prepare('SELECT * FROM hazards WHERE id = ?').get(id);
  if (!hazard) {
    res.status(404).json({ error: '隐患不存在' });
    return;
  }
  // 删除附件文件
  const attachments = db.prepare('SELECT * FROM attachments WHERE hazard_id = ?').all(id) as any[];
  for (const att of attachments) {
    try {
      fs.unlinkSync(att.file_path);
    } catch { /* ignore */ }
  }
  db.prepare('DELETE FROM hazards WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

// 批量删除（仅管理员）
router.post('/batch-delete', authMiddleware, adminMiddleware, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: '请选择要删除的记录' });
    return;
  }
  const placeholders = ids.map(() => '?').join(',');
  // 删除附件文件
  const attachments = db.prepare(`SELECT * FROM attachments WHERE hazard_id IN (${placeholders})`).all(...ids) as any[];
  for (const att of attachments) {
    try { fs.unlinkSync(att.file_path); } catch { /* ignore */ }
  }
  db.prepare(`DELETE FROM hazards WHERE id IN (${placeholders})`).run(...ids);
  res.json({ message: `已删除 ${ids.length} 条记录` });
});

// 批量导入（仅管理员）
router.post('/batch-import', authMiddleware, adminMiddleware, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: '没有可导入的数据' });
    return;
  }
  const now = new Date().toISOString();
  const baseId = Date.now();
  const insert = db.prepare(`
    INSERT INTO hazards (id, date, location, description, responsible, accept_time, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((list: any[]) => {
    list.forEach((item, idx) => {
      const id = `${baseId}-${idx}`;
      insert.run(
        id,
        item.date || now.slice(0, 10),
        item.location || hazardConfig.importDefaults.location,
        item.description || hazardConfig.importDefaults.description,
        item.responsible || hazardConfig.importDefaults.responsible,
        item.acceptTime || item.accept_time || '',
        item.status || 'unfixed',
        req.user!.userId,
        now,
        now,
      );
    });
  });
  tx(items);
  res.json({ count: items.length });
});

// 上传附件
router.post('/:id/attachments', authMiddleware, upload.single('file'), (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    res.status(400).json({ error: '请选择文件' });
    return;
  }
  const hazard = db.prepare('SELECT id FROM hazards WHERE id = ?').get(id);
  if (!hazard) {
    // 删除已上传的文件
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    res.status(404).json({ error: '隐患不存在' });
    return;
  }

  // 修复文件名编码：multer 的 originalname 可能是 Latin-1 误解码的 UTF-8
  let fileName = req.file.originalname;
  if (/[\x80-\xFF]{3,}/.test(fileName) && !/[\u4e00-\u9fff\u3040-\u309F\u30A0-\u30FF]/.test(fileName)) {
    // 检测到 mojibake：尝试从 Latin-1 字节恢复 UTF-8
    try {
      const decoded = Buffer.from(fileName, 'latin1').toString('utf-8');
      if (/[\u4e00-\u9fff]/.test(decoded)) fileName = decoded;
    } catch { /* 保持原名 */ }
  }

  const attId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uploadTime = formatTime(new Date().toISOString());
  db.prepare(`
    INSERT INTO attachments (id, hazard_id, name, size, type, file_path, upload_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(attId, id, fileName, req.file.size, req.file.mimetype, req.file.path, uploadTime);

  res.json({
    id: attId,
    name: fileName,
    size: req.file.size,
    type: req.file.mimetype,
    url: `/api/hazards/attachments/${attId}/file`,
    uploadTime,
  });
});

// 删除附件（仅管理员）
router.delete('/attachments/:attId', authMiddleware, adminMiddleware, (req, res) => {
  const { attId } = req.params;
  const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attId) as any;
  if (!att) {
    res.status(404).json({ error: '附件不存在' });
    return;
  }
  try { fs.unlinkSync(att.file_path); } catch { /* ignore */ }
  db.prepare('DELETE FROM attachments WHERE id = ?').run(attId);
  res.json({ message: '附件已删除' });
});

// 下载/预览附件文件
router.get('/attachments/:attId/file', authMiddleware, (req, res) => {
  const { attId } = req.params;
  const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attId) as any;
  if (!att) {
    res.status(404).json({ error: '附件不存在' });
    return;
  }
  if (!fs.existsSync(att.file_path)) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }
  const stat = fs.statSync(att.file_path);
  res.setHeader('Content-Type', att.type);
  res.setHeader('Content-Length', stat.size);
  // 尝试修复文件名：如果已经是 mojibake，从磁盘文件名提取后备名称
  let displayName = att.name;
  const diskName = path.basename(att.file_path);
  // 如果原始名称包含乱码特征（连续高字节 Latin-1），用磁盘文件名作为显示名
  if (/[\x80-\xFF]{3,}/.test(displayName) && !/[\u4e00-\u9fff]/.test(displayName)) {
    displayName = diskName;
  }
  const encoded = encodeURIComponent(displayName);
  res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
  fs.createReadStream(att.file_path).pipe(res);
});

export default router;
