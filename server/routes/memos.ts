import { Router } from 'express';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 工具：格式化时间
function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 获取当前用户的备忘录列表
router.get('/', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM memos
    WHERE user_id = ?
    ORDER BY is_completed ASC, is_important DESC, create_time DESC
  `).all(req.user!.userId) as any[];

  const memos = rows.map((row) => ({
    id: row.id,
    content: row.content,
    isImportant: !!row.is_important,
    isCompleted: !!row.is_completed,
    createTime: row.create_time,
  }));
  res.json(memos);
});

// 新增备忘
router.post('/', authMiddleware, (req, res) => {
  const { content, isImportant } = req.body;
  if (!content?.trim()) {
    res.status(400).json({ error: '备忘内容不能为空' });
    return;
  }
  const id = Date.now().toString();
  const createTime = formatTime(new Date().toISOString());
  db.prepare(`
    INSERT INTO memos (id, content, is_important, is_completed, user_id, create_time)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(id, content.trim(), isImportant ? 1 : 0, req.user!.userId, createTime);

  res.json({
    id,
    content: content.trim(),
    isImportant: !!isImportant,
    isCompleted: false,
    createTime,
  });
});

// 更新备忘（切换重要/完成状态，或修改内容）
router.put('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const memo = db.prepare('SELECT * FROM memos WHERE id = ? AND user_id = ?').get(id, req.user!.userId) as any;
  if (!memo) {
    res.status(404).json({ error: '备忘不存在' });
    return;
  }
  const fields: string[] = [];
  const values: any[] = [];
  if (req.body.content !== undefined) {
    fields.push('content = ?');
    values.push(String(req.body.content).trim());
  }
  if (req.body.isImportant !== undefined) {
    fields.push('is_important = ?');
    values.push(req.body.isImportant ? 1 : 0);
  }
  if (req.body.isCompleted !== undefined) {
    fields.push('is_completed = ?');
    values.push(req.body.isCompleted ? 1 : 0);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: '没有需要更新的字段' });
    return;
  }
  values.push(id, req.user!.userId);
  db.prepare(`UPDATE memos SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM memos WHERE id = ?').get(id) as any;
  res.json({
    id: updated.id,
    content: updated.content,
    isImportant: !!updated.is_important,
    isCompleted: !!updated.is_completed,
    createTime: updated.create_time,
  });
});

// 删除备忘
router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const memo = db.prepare('SELECT id FROM memos WHERE id = ? AND user_id = ?').get(id, req.user!.userId);
  if (!memo) {
    res.status(404).json({ error: '备忘不存在' });
    return;
  }
  db.prepare('DELETE FROM memos WHERE id = ? AND user_id = ?').run(id, req.user!.userId);
  res.json({ message: '删除成功' });
});

export default router;
