// EXPORTS: IUser, UserRole, useAuth
// localStorage 版本：本地认证，不依赖后端 API
// 默认管理员 admin/admin123，子账号存储在 localStorage

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import appConfig from '@/data/app-config.json';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'user';

export interface IUser {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
}

// 本地存储的用户记录（含密码哈希）
interface LocalUserRecord {
  id: string;
  username: string;
  password: string; // bcrypt hash
  role: UserRole;
  createdAt: string;
}

const USERS_KEY = '__app_safety_users';
const CURRENT_USER_KEY = '__app_safety_current_user';

function loadUsers(): LocalUserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      // 首次使用，创建默认管理员
      const admin = appConfig.auth.defaultAdmin;
      const hashedPwd = bcrypt.hashSync(admin.password, appConfig.auth.bcryptSaltRounds);
      const adminRecord: LocalUserRecord = {
        id: admin.id,
        username: admin.username,
        password: hashedPwd,
        role: admin.role as UserRole,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(USERS_KEY, JSON.stringify([adminRecord]));
      return [adminRecord];
    }
    return JSON.parse(raw) as LocalUserRecord[];
  } catch {
    return [];
  }
}

function saveUsers(users: LocalUserRecord[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadCurrentUser(): IUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IUser;
  } catch {
    return null;
  }
}

function saveCurrentUser(user: IUser | null) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

function toIUser(record: LocalUserRecord): IUser {
  return {
    id: record.id,
    username: record.username,
    role: record.role,
    createdAt: record.createdAt,
  };
}

interface AuthContextType {
  currentUser: IUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  isLoggedIn: boolean;
  subUsers: IUser[];
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  changePassword: (oldPwd: string, newPwd: string) => Promise<{ success: boolean; message: string }>;
  createUser: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message: string }>;
  resetUserPassword: (userId: string, newPwd: string) => Promise<{ success: boolean; message: string }>;
  refreshSubUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [subUsers, setSubUsers] = useState<IUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初始化：从 localStorage 恢复登录态
    loadUsers(); // 确保默认管理员存在
    const saved = loadCurrentUser();
    if (saved) {
      setCurrentUser(saved);
    }
    setIsLoading(false);
  }, []);

  // 拉取子账号列表（仅管理员）
  const refreshSubUsers = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const users = loadUsers();
      const subs = users
        .filter((u) => u.id !== currentUser.id)
        .map(toIUser);
      setSubUsers(subs);
    } catch (err: any) {
      logger.error('加载子账号列表失败:', String(err?.message ?? err));
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      refreshSubUsers();
    } else {
      setSubUsers([]);
    }
  }, [currentUser, refreshSubUsers]);

  // 登录
  const login = useCallback(
    async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
      const trimmedUser = username.trim();
      if (!trimmedUser || !password) {
        return { success: false, message: '请输入用户名和密码' };
      }

      try {
        const users = loadUsers();
        const record = users.find((u) => u.username === trimmedUser);
        if (!record) {
          return { success: false, message: '用户名或密码错误' };
        }
        if (!bcrypt.compareSync(password, record.password)) {
          return { success: false, message: '用户名或密码错误' };
        }
        const user = toIUser(record);
        setCurrentUser(user);
        saveCurrentUser(user);
        return { success: true, message: '登录成功' };
      } catch (err: any) {
        logger.error('登录失败:', String(err?.message ?? err));
        return { success: false, message: '登录失败' };
      }
    },
    [],
  );

  // 退出登录
  const logout = useCallback(() => {
    setCurrentUser(null);
    saveCurrentUser(null);
    setSubUsers([]);
  }, []);

  // 修改当前用户密码
  const changePassword = useCallback(
    async (oldPwd: string, newPwd: string): Promise<{ success: boolean; message: string }> => {
      if (!currentUser) return { success: false, message: '未登录' };
      if (newPwd.length < appConfig.auth.minPasswordLength) {
        return { success: false, message: `新密码至少 ${appConfig.auth.minPasswordLength} 位` };
      }

      try {
        const users = loadUsers();
        const record = users.find((u) => u.id === currentUser.id);
        if (!record) {
          return { success: false, message: '用户不存在' };
        }
        if (!bcrypt.compareSync(oldPwd, record.password)) {
          return { success: false, message: '原密码错误' };
        }
        record.password = bcrypt.hashSync(newPwd, appConfig.auth.bcryptSaltRounds);
        saveUsers(users);
        return { success: true, message: '密码修改成功' };
      } catch (err: any) {
        logger.error('修改密码失败:', String(err?.message ?? err));
        return { success: false, message: '修改密码失败' };
      }
    },
    [currentUser],
  );

  // 管理员：创建子账号
  const createUser = useCallback(
    async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
      const trimmed = username.trim();
      if (!trimmed || !password) {
        return { success: false, message: '用户名和密码不能为空' };
      }
      if (password.length < appConfig.auth.minPasswordLength) {
        return { success: false, message: `密码至少 ${appConfig.auth.minPasswordLength} 位` };
      }

      try {
        const users = loadUsers();
        if (users.some((u) => u.username === trimmed)) {
          return { success: false, message: '用户名已存在' };
        }
        const newRecord: LocalUserRecord = {
          id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          username: trimmed,
          password: bcrypt.hashSync(password, appConfig.auth.bcryptSaltRounds),
          role: 'user',
          createdAt: new Date().toISOString(),
        };
        users.push(newRecord);
        saveUsers(users);
        await refreshSubUsers();
        return { success: true, message: '子账号创建成功' };
      } catch (err: any) {
        logger.error('创建子账号失败:', String(err?.message ?? err));
        return { success: false, message: '创建子账号失败' };
      }
    },
    [refreshSubUsers],
  );

  // 管理员：删除子账号
  const deleteUser = useCallback(
    async (userId: string): Promise<{ success: boolean; message: string }> => {
      try {
        const users = loadUsers();
        const filtered = users.filter((u) => u.id !== userId);
        saveUsers(filtered);
        await refreshSubUsers();
        return { success: true, message: '子账号已删除' };
      } catch (err: any) {
        logger.error('删除子账号失败:', String(err?.message ?? err));
        return { success: false, message: '删除子账号失败' };
      }
    },
    [refreshSubUsers],
  );

  // 管理员：重置子账号密码
  const resetUserPassword = useCallback(
    async (userId: string, newPwd: string): Promise<{ success: boolean; message: string }> => {
      if (newPwd.length < appConfig.auth.minPasswordLength) {
        return { success: false, message: `密码至少 ${appConfig.auth.minPasswordLength} 位` };
      }

      try {
        const users = loadUsers();
        const record = users.find((u) => u.id === userId);
        if (!record) {
          return { success: false, message: '用户不存在' };
        }
        record.password = bcrypt.hashSync(newPwd, appConfig.auth.bcryptSaltRounds);
        saveUsers(users);
        return { success: true, message: '密码重置成功' };
      } catch (err: any) {
        logger.error('重置密码失败:', String(err?.message ?? err));
        return { success: false, message: '重置密码失败' };
      }
    },
    [],
  );

  const value: AuthContextType = {
    currentUser,
    isLoading,
    isAdmin: currentUser?.role === 'admin',
    isLoggedIn: !!currentUser,
    subUsers,
    login,
    logout,
    changePassword,
    createUser,
    deleteUser,
    resetUserPassword,
    refreshSubUsers,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
