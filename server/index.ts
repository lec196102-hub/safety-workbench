// 加载 .env 环境变量（必须在其他模块导入之前）
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from './lib/logger';
import { appConfig } from './lib/config';

// 初始化数据库（副作用导入）
import './db';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import hazardRoutes from './routes/hazards';
import memoRoutes from './routes/memos';
import safetyFileRoutes from './routes/safety-files';
import aiRoutes from './routes/ai';
import specialWorkRoutes from './routes/special-work';

const app = express();
const PORT = Number(process.env.SERVER_PORT || process.env.PORT || appConfig.server.port);

// 中间件
app.use(cors());
app.use(express.json({ limit: appConfig.fileLimits.bodyLimit }));
app.use(express.urlencoded({ extended: true }));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hazards', hazardRoutes);
app.use('/api/memos', memoRoutes);
app.use('/api/safety-files', safetyFileRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/special-work', specialWorkRoutes);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('[Server Error]', String(err));
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: '文件大小超过限制' });
    return;
  }
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`[Server] 安全生产工作台后端服务已启动: http://localhost:${PORT}`);
  logger.info(`[Server] API 前缀: /api`);
});
