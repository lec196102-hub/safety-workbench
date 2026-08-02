import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { db } from '../db';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { appConfig } from '../lib/config';

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), appConfig.server.fileUploadDir);
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: appConfig.fileLimits.safetyFileMaxSize }, // 20MB
});

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 获取文件夹列表
router.get('/folders', authMiddleware, (_req, res) => {
  const rows = db.prepare('SELECT * FROM folders ORDER BY is_default DESC, create_time ASC').all() as any[];
  const folders = rows.map((row) => ({
    id: row.id,
    name: row.name,
    isDefault: !!row.is_default,
    createTime: row.create_time,
  }));
  res.json(folders);
});

// 新建文件夹（仅管理员）
router.post('/folders', authMiddleware, adminMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: '文件夹名称不能为空' });
    return;
  }
  const id = `folder-${Date.now()}`;
  const createTime = formatTime(new Date().toISOString());
  db.prepare('INSERT INTO folders (id, name, is_default, create_time) VALUES (?, ?, 0, ?)')
    .run(id, name.trim(), createTime);
  res.json({ id, name: name.trim(), isDefault: false, createTime });
});

// 重命名文件夹（仅管理员）
router.put('/folders/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: '文件夹名称不能为空' });
    return;
  }
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as any;
  if (!folder) {
    res.status(404).json({ error: '文件夹不存在' });
    return;
  }
  db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name.trim(), id);
  res.json({ id, name: name.trim() });
});

// 删除文件夹（仅管理员）
router.delete('/folders/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as any;
  if (!folder) {
    res.status(404).json({ error: '文件夹不存在' });
    return;
  }
  if (folder.is_default) {
    res.status(400).json({ error: '默认文件夹不能删除' });
    return;
  }
  // 将该文件夹下的文件移到默认文件夹
  const defaultFolder = db.prepare('SELECT id FROM folders WHERE is_default = 1').get() as any;
  const defaultId = defaultFolder?.id || appConfig.defaultFolders.find(f => f.isDefault)?.id;
  db.prepare('UPDATE files SET folder_id = ? WHERE folder_id = ?').run(defaultId, id);
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  res.json({ message: '文件夹已删除' });
});

// 获取文件列表（按文件夹）
router.get('/files', authMiddleware, (req, res) => {
  const { folderId, keyword } = req.query;
  let sql = 'SELECT * FROM files WHERE 1=1';
  const params: any[] = [];
  if (folderId) {
    sql += ' AND folder_id = ?';
    params.push(folderId);
  }
  if (keyword) {
    sql += ' AND name LIKE ?';
    params.push(`%${keyword}%`);
  }
  sql += ' ORDER BY upload_time DESC';
  const rows = db.prepare(sql).all(...params) as any[];
  const files = rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    size: row.size,
    folderId: row.folder_id,
    url: `/api/safety-files/files/${row.id}/download`,
    uploadTime: row.upload_time,
  }));
  res.json(files);
});

// 上传文件（仅管理员）
router.post('/files/upload', authMiddleware, adminMiddleware, upload.single('file'), (req, res) => {
  const { folderId } = req.body;
  if (!req.file) {
    res.status(400).json({ error: '请选择文件' });
    return;
  }
  const fid = folderId || 'default';
  // 确保文件夹存在
  const folder = db.prepare('SELECT id FROM folders WHERE id = ?').get(fid);
  if (!folder) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    res.status(400).json({ error: '文件夹不存在' });
    return;
  }
  const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uploadTime = formatTime(new Date().toISOString());
  db.prepare(`
    INSERT INTO files (id, name, type, size, file_path, folder_id, upload_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.file.originalname, req.file.mimetype, req.file.size, req.file.path, fid, uploadTime);

  res.json({
    id,
    name: req.file.originalname,
    type: req.file.mimetype,
    size: req.file.size,
    folderId: fid,
    url: `/api/safety-files/files/${id}/download`,
    uploadTime,
  });
});

// 删除文件（仅管理员）
router.delete('/files/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as any;
  if (!file) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }
  try { fs.unlinkSync(file.file_path); } catch { /* ignore */ }
  db.prepare('DELETE FROM files WHERE id = ?').run(id);
  res.json({ message: '文件已删除' });
});

// 下载/预览文件
router.get('/files/:id/download', authMiddleware, (req, res) => {
  const { id } = req.params;
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as any;
  if (!file) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }
  if (!fs.existsSync(file.file_path)) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }
  res.setHeader('Content-Type', file.type);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
  fs.createReadStream(file.file_path).pipe(res);
});

export default router;
