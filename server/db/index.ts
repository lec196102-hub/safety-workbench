// 使用 Node.js 22 内置的 node:sqlite 替代 better-sqlite3（无需原生编译）
// 提供 better-sqlite3 兼容的 API 接口
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { logger } from '../lib/logger';
import { appConfig, seedHazards } from '../lib/config';

// 抑制 node:sqlite 实验性警告
process.removeAllListeners('warning');

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'safety.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const rawDb = new DatabaseSync(DB_PATH);
rawDb.exec('PRAGMA journal_mode = WAL');
rawDb.exec('PRAGMA foreign_keys = ON');

// 包装器：提供 better-sqlite3 兼容的 db 对象（含 transaction 方法）
export const db = {
  prepare: (sql: string) => rawDb.prepare(sql),
  exec: (sql: string) => rawDb.exec(sql),
  transaction: <T extends (...args: any[]) => any>(fn: T): T => {
    return ((...args: any[]) => {
      rawDb.exec('BEGIN');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT');
        return result;
      } catch (err) {
        rawDb.exec('ROLLBACK');
        throw err;
      }
    }) as T;
  },
};

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hazards (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    responsible TEXT NOT NULL,
    accept_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unfixed',
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    hazard_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    upload_time TEXT NOT NULL,
    FOREIGN KEY (hazard_id) REFERENCES hazards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS memos (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    is_important INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    user_id TEXT NOT NULL,
    create_time TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    create_time TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    upload_time TEXT NOT NULL,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS special_works (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'hot_work',
    work_time TEXT NOT NULL,
    location TEXT NOT NULL,
    applicant TEXT NOT NULL,
    approver TEXT NOT NULL,
    guardian TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS special_work_attachments (
    id TEXT PRIMARY KEY,
    work_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    upload_time TEXT NOT NULL,
    FOREIGN KEY (work_id) REFERENCES special_works(id) ON DELETE CASCADE
  );
`);

// 初始化默认数据
function initDefaultData() {
  // 默认管理员
  const adminRow = db.prepare('SELECT id FROM users WHERE username = ?').get(appConfig.auth.defaultAdmin.username) as any;
  if (!adminRow) {
    const hashedPwd = bcrypt.hashSync(appConfig.auth.defaultAdmin.password, appConfig.auth.bcryptSaltRounds);
    db.prepare(`
      INSERT INTO users (id, username, password, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(appConfig.auth.defaultAdmin.id, appConfig.auth.defaultAdmin.username, hashedPwd, appConfig.auth.defaultAdmin.role, new Date().toISOString());
    logger.info(`[DB] 默认管理员账号已创建: ${appConfig.auth.defaultAdmin.username} / ${appConfig.auth.defaultAdmin.password}`);
  }

  // 默认文件夹
  const defaultFolder = db.prepare('SELECT id FROM folders WHERE is_default = 1').get() as any;
  if (!defaultFolder) {
    const now = new Date().toISOString();
    const insertFolder = db.prepare(`INSERT INTO folders (id, name, is_default, create_time) VALUES (?, ?, ?, ?)`);
    for (const folder of appConfig.defaultFolders) {
      insertFolder.run(folder.id, folder.name, folder.isDefault ? 1 : 0, now);
    }
    logger.info('[DB] 默认文件夹已创建');
  }

  // 示例隐患数据（仅当表为空时）
  const hazardCount = (db.prepare('SELECT COUNT(*) as cnt FROM hazards').get() as any).cnt;
  if (hazardCount === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO hazards (id, date, location, description, responsible, accept_time, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((items: any[]) => {
      for (const h of items) {
        insert.run(h.id, h.date, h.location, h.description, h.responsible, h.acceptTime, h.status, 'admin', now, now);
      }
    });
    tx(seedHazards as any[]);
    logger.info(`[DB] 已插入 ${seedHazards.length} 条示例隐患数据`);
  }
}

initDefaultData();

logger.info('[DB] 数据库初始化完成:', String(DB_PATH));
