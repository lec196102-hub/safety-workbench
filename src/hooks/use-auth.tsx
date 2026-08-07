// EXPORTS: IUser, UserRole, useAuth, AuthProvider
// API 版本：通过后端 API 进行认证，JWT token 由 api.ts 统一管理
// 用户数据不再写入 localStorage，仅 token 由 api.ts 持久化

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import appConfig from '@/data/app-config.json';
import { api, getAuthToken, setAuthToken, clearAuthToken } from '@/lib/api';

export type UserRole = 'admin' | 'user';

export interface IUser {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
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

  // 初始化：若 localStorage 中存在 token，调用 GET /auth/me 验证并恢复会话
  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    (async () => {
      try {
        const user = await api.get<IUser>('/auth/me');
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch (err: any) {
        logger.error('恢复会话失败:', String(err?.message ?? err));
        // token 无效或过期，清理本地凭证
        clearAuthToken();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 拉取子账号列表（仅管理员）
  const refreshSubUsers = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const users = await api.get<IUser[]>('/users');
      const subs = users.filter((u) => u.id !== currentUser.id);
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
        const data = await api.post<{ token: string; user: IUser }>(
          '/auth/login',
          { username: trimmedUser, password },
          { noAuth: true },
        );
        setAuthToken(data.token);
        setCurrentUser(data.user);
        return { success: true, message: '登录成功' };
      } catch (err: any) {
        logger.error('登录失败:', String(err?.message ?? err));
        return { success: false, message: String(err?.message ?? '登录失败') };
      }
    },
    [],
  );

  // 退出登录
  const logout = useCallback(() => {
    clearAuthToken();
    setCurrentUser(null);
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
        const data = await api.post<{ message: string }>('/auth/change-password', {
          oldPassword: oldPwd,
          newPassword: newPwd,
        });
        return { success: true, message: data.message || '密码修改成功' };
      } catch (err: any) {
        logger.error('修改密码失败:', String(err?.message ?? err));
        return { success: false, message: String(err?.message ?? '修改密码失败') };
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
        await api.post<IUser>('/users', { username: trimmed, password });
        await refreshSubUsers();
        return { success: true, message: '子账号创建成功' };
      } catch (err: any) {
        logger.error('创建子账号失败:', String(err?.message ?? err));
        return { success: false, message: String(err?.message ?? '创建子账号失败') };
      }
    },
    [refreshSubUsers],
  );

  // 管理员：删除子账号
  const deleteUser = useCallback(
    async (userId: string): Promise<{ success: boolean; message: string }> => {
      try {
        const data = await api.delete<{ message: string }>(`/users/${userId}`);
        await refreshSubUsers();
        return { success: true, message: data.message || '子账号已删除' };
      } catch (err: any) {
        logger.error('删除子账号失败:', String(err?.message ?? err));
        return { success: false, message: String(err?.message ?? '删除子账号失败') };
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
        const data = await api.post<{ message: string }>(
          `/users/${userId}/reset-password`,
          { newPassword: newPwd },
        );
        return { success: true, message: data.message || '密码重置成功' };
      } catch (err: any) {
        logger.error('重置密码失败:', String(err?.message ?? err));
        return { success: false, message: String(err?.message ?? '重置密码失败') };
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
