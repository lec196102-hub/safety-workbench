import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { appConfig } from '../lib/config';

const router = Router();

// 获取子账号列表（仅管理员）
router.get('/', authMiddleware, adminMiddleware, (_req, res) => {
  const users = db.prepare(`
    SELECT id, username, role, created_at as createdAt
    FROM users
    WHERE role = 'user'
    ORDER BY created_at DESC
  `).all();
  res.json(users);
});

// 创建子账号（仅管理员）
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  const { username, password } = req.body;
  const trimmed = username?.trim();
  if (!trimmed || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }
  if (password.length < appConfig.auth.minPasswordLength) {
    res.status(400).json({ error: `密码至少 ${appConfig.auth.minPasswordLength} 位` });
    return;
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(trimmed);
  if (exists) {
    res.status(400).json({ error: '用户名已存在' });
    return;
  }

  const id = `${appConfig.idPrefixes.user}${Date.now()}`;
  const hashed = bcrypt.hashSync(password, appConfig.auth.bcryptSaltRounds);
  db.prepare(`
    INSERT INTO users (id, username, password, role, created_at)
    VALUES (?, ?, ?, 'user', ?)
  `).run(id, trimmed, hashed, new Date().toISOString());

  res.json({
    id,
    username: trimmed,
    role: 'user',
    createdAt: new Date().toISOString(),
  });
});

// 删除子账号（仅管理员）
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  if (user.username === appConfig.auth.defaultAdmin.username) {
    res.status(400).json({ error: '不能删除管理员账号' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ message: '子账号已删除' });
});

// 重置子账号密码（仅管理员）
router.post('/:id/reset-password', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < appConfig.auth.minPasswordLength) {
    res.status(400).json({ error: `密码至少 ${appConfig.auth.minPasswordLength} 位` });
    return;
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  if (user.username === appConfig.auth.defaultAdmin.username) {
    res.status(400).json({ error: '请使用修改密码功能修改管理员密码' });
    return;
  }
  const hashed = bcrypt.hashSync(newPassword, appConfig.auth.bcryptSaltRounds);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, id);
  res.json({ message: '密码重置成功' });
});

export default router;
