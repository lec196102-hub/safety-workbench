import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { db } from '../db';
import { logger } from '../lib/logger';
import { appConfig } from '../lib/config';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const UPLOAD_DIR = path.resolve(process.cwd(), 'data/uploads/special-work');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
});

function formatTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

// ---- CRUD ----

// 获取列表
router.get('/', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT sw.*, GROUP_CONCAT(
        json_object('id', swa.id, 'name', swa.name, 'size', swa.size, 'type', swa.type,
          'file_path', swa.file_path, 'upload_time', swa.upload_time)
      ) as attachments_json
      FROM special_works sw
      LEFT JOIN special_work_attachments swa ON swa.work_id = sw.id
      GROUP BY sw.id
      ORDER BY sw.created_at DESC
    `).all() as any[];

    const result = rows.map((r) => ({
      id: r.id,
      category: r.category,
      workTime: r.work_time,
      location: r.location,
      applicant: r.applicant,
      approver: r.approver,
      guardian: r.guardian,
      endTime: r.end_time,
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      attachments: r.attachments_json
        ? JSON.parse(`[${r.attachments_json}]`)
            .filter((a: any) => a && a.id)
            .map((a: any) => ({
              id: a.id,
              name: a.name,
              size: a.size,
              type: a.type,
              filePath: a.file_path,
              uploadTime: a.upload_time,
              url: `/api/special-work/attachments/${a.id}/file`,
            }))
        : [],
    }));

    res.json(result);
  } catch (err: any) {
    logger.error('获取特种作业列表失败:', err.message);
    res.status(500).json({ error: '获取列表失败' });
  }
});

// 新增
router.post('/', (req, res) => {
  try {
    const { category, workTime, location, applicant, approver, guardian, endTime } = req.body;
    if (!workTime || !location || !applicant || !approver || !guardian || !endTime) {
      res.status(400).json({ error: '必填字段不能为空' });
      return;
    }
    const now = new Date().toISOString();
    const id = `sw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`
      INSERT INTO special_works (id, category, work_time, location, applicant, approver, guardian, end_time, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(id, category || 'hot_work', workTime, location, applicant, approver, guardian, endTime, (req as any).user?.id || null, now, now);

    const row = db.prepare('SELECT * FROM special_works WHERE id = ?').get(id) as any;
    res.json({
      id: row.id,
      category: row.category,
      workTime: row.work_time,
      location: row.location,
      applicant: row.applicant,
      approver: row.approver,
      guardian: row.guardian,
      endTime: row.end_time,
      status: row.status,
      attachments: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err: any) {
    logger.error('新增特种作业失败:', err.message);
    res.status(500).json({ error: '新增失败' });
  }
});

// 更新
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { category, workTime, location, applicant, approver, guardian, endTime, status } = req.body;
    const existing = db.prepare('SELECT id FROM special_works WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE special_works SET
        category = COALESCE(?, category),
        work_time = COALESCE(?, work_time),
        location = COALESCE(?, location),
        applicant = COALESCE(?, applicant),
        approver = COALESCE(?, approver),
        guardian = COALESCE(?, guardian),
        end_time = COALESCE(?, end_time),
        status = COALESCE(?, status),
        updated_at = ?
      WHERE id = ?
    `).run(category ?? null, workTime ?? null, location ?? null, applicant ?? null, approver ?? null, guardian ?? null, endTime ?? null, status ?? null, now, id);

    res.json({ success: true });
  } catch (err: any) {
    logger.error('更新特种作业失败:', err.message);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    // 删除关联附件文件
    const atts = db.prepare('SELECT file_path FROM special_work_attachments WHERE work_id = ?').all(id) as any[];
    for (const att of atts) {
      try { fs.unlinkSync(att.file_path); } catch { /* ignore */ }
    }
    db.prepare('DELETE FROM special_works WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('删除特种作业失败:', err.message);
    res.status(500).json({ error: '删除失败' });
  }
});

// 审批流转
router.post('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: '无效的状态值' });
      return;
    }
    const existing = db.prepare('SELECT id FROM special_works WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE special_works SET status = ?, updated_at = ? WHERE id = ?").run(status, now, id);
    res.json({ success: true, status });
  } catch (err: any) {
    logger.error('审批流转失败:', err.message);
    res.status(500).json({ error: '审批操作失败' });
  }
});

// ---- 附件 ----

// 上传附件
router.post('/:id/attachments', upload.single('file'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM special_works WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: '作业记录不存在' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: '未上传文件' });
      return;
    }

    let fileName = req.file.originalname;
    if (/[\x80-\xFF]{3,}/.test(fileName) && !/[\u4e00-\u9fff\u3040-\u309F\u30A0-\u30FF]/.test(fileName)) {
      try {
        const decoded = Buffer.from(fileName, 'latin1').toString('utf-8');
        if (/[\u4e00-\u9fff]/.test(decoded)) fileName = decoded;
      } catch { /* 保持原名 */ }
    }

    const attId = `swatt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const uploadTime = formatTime(new Date().toISOString());
    db.prepare(`
      INSERT INTO special_work_attachments (id, work_id, name, size, type, file_path, upload_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(attId, id, fileName, req.file.size, req.file.mimetype, req.file.path, uploadTime);

    res.json({
      id: attId,
      name: fileName,
      size: req.file.size,
      type: req.file.mimetype,
      url: `/api/special-work/attachments/${attId}/file`,
      uploadTime,
    });
  } catch (err: any) {
    logger.error('上传特种作业附件失败:', err.message);
    res.status(500).json({ error: '上传失败' });
  }
});

// 下载/预览附件
router.get('/attachments/:attId/file', (req, res) => {
  try {
    const { attId } = req.params;
    const att = db.prepare('SELECT * FROM special_work_attachments WHERE id = ?').get(attId) as any;
    if (!att || !fs.existsSync(att.file_path)) {
      res.status(404).json({ error: '文件不存在' });
      return;
    }
    const stat = fs.statSync(att.file_path);
    const encoded = encodeURIComponent(att.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_'));
    res.setHeader('Content-Type', att.type || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    fs.createReadStream(att.file_path).pipe(res);
  } catch (err: any) {
    logger.error('获取特种作业附件失败:', err.message);
    res.status(500).json({ error: '文件读取失败' });
  }
});

// 删除附件
router.delete('/attachments/:attId', (req, res) => {
  try {
    const { attId } = req.params;
    const att = db.prepare('SELECT file_path FROM special_work_attachments WHERE id = ?').get(attId) as any;
    if (att) {
      try { fs.unlinkSync(att.file_path); } catch { /* ignore */ }
    }
    db.prepare('DELETE FROM special_work_attachments WHERE id = ?').run(attId);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('删除特种作业附件失败:', err.message);
    res.status(500).json({ error: '删除附件失败' });
  }
});

export default router;
