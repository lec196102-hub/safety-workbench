// EXPORTS: IMemo, useMemos
// 后端 API 版本：所有数据通过 src/lib/api.ts 与后端同步

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface IMemo {
  id: string;
  content: string;
  isImportant: boolean;
  isCompleted: boolean;
  createTime: string;
}

export function useMemos() {
  const [memos, setMemos] = useState<IMemo[]>([]);
  const [loading, setLoading] = useState(false);

  // 初始化：挂载时从后端加载备忘列表
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<IMemo[]>('/memos');
        if (!cancelled) {
          setMemos(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('加载备忘录失败:', String(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 刷新：重新拉取全量数据
  const refreshMemos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<IMemo[]>('/memos');
      setMemos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('刷新备忘录失败:', String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 新增备忘：POST 后插入到列表头部，提供即时 UI 反馈
  const addMemo = useCallback(
    async (content: string, isImportant = false) => {
      try {
        const created = await api.post<IMemo>('/memos', { content, isImportant });
        setMemos((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        console.error('新增备忘录失败:', String(err));
        throw err;
      }
    },
    [],
  );

  // 删除备忘：DELETE 后从本地状态移除
  const deleteMemo = useCallback(async (id: string) => {
    // 乐观更新：先从本地移除
    setMemos((prev) => prev.filter((m) => m.id !== id));
    try {
      await api.delete(`/memos/${id}`);
    } catch (err) {
      console.error('删除备忘录失败:', String(err));
      // 失败时回滚：重新拉取
      try {
        const data = await api.get<IMemo[]>('/memos');
        setMemos(Array.isArray(data) ? data : []);
      } catch (rollbackErr) {
        console.error('回滚备忘录失败:', String(rollbackErr));
      }
    }
  }, []);

  // 切换重要状态：PUT 后更新本地状态
  const toggleImportant = useCallback(
    async (id: string) => {
      let nextValue = false;
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id === id) {
            nextValue = !m.isImportant;
            return { ...m, isImportant: nextValue };
          }
          return m;
        }),
      );
      try {
        await api.put<IMemo>(`/memos/${id}`, { isImportant: nextValue });
      } catch (err) {
        console.error('切换重要状态失败:', String(err));
        // 失败时回滚该项
        setMemos((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, isImportant: !nextValue } : m,
          ),
        );
      }
    },
    [],
  );

  // 切换完成状态：PUT 后更新本地状态
  const toggleCompleted = useCallback(
    async (id: string) => {
      let nextValue = false;
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id === id) {
            nextValue = !m.isCompleted;
            return { ...m, isCompleted: nextValue };
          }
          return m;
        }),
      );
      try {
        await api.put<IMemo>(`/memos/${id}`, { isCompleted: nextValue });
      } catch (err) {
        console.error('切换完成状态失败:', String(err));
        // 失败时回滚该项
        setMemos((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, isCompleted: !nextValue } : m,
          ),
        );
      }
    },
    [],
  );

  return {
    memos,
    loading,
    refreshMemos,
    addMemo,
    deleteMemo,
    toggleImportant,
    toggleCompleted,
  };
}
