import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { signToken, authMiddleware } from '../middleware/auth';
import { appConfig } from '../lib/config';

const router = Router();

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as any;
  if (!user) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const token = signToken({ userId: user.id, username: user.username, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.created_at,
    },
  });
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.user!.userId) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.created_at,
  });
});

// 修改密码
router.post('/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: '原密码和新密码不能为空' });
    return;
  }
  if (newPassword.length < appConfig.auth.minPasswordLength) {
    res.status(400).json({ error: `新密码至少 ${appConfig.auth.minPasswordLength} 位` });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  const valid = bcrypt.compareSync(oldPassword, user.password);
  if (!valid) {
    res.status(400).json({ error: '原密码错误' });
    return;
  }

  const hashed = bcrypt.hashSync(newPassword, appConfig.auth.bcryptSaltRounds);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
  res.json({ message: '密码修改成功' });
});

export default router;
