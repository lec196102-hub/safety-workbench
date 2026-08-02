// EXPORTS: IMemo, useMemos
// localStorage 版本：所有数据存储在浏览器本地

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';

export interface IMemo {
  id: string;
  content: string;
  isImportant: boolean;
  isCompleted: boolean;
  createTime: string;
}

const STORAGE_KEY = '__app_safety_memos';

function loadMemos(): IMemo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as IMemo[];
  } catch {
    return [];
  }
}

function saveMemos(memos: IMemo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
  } catch (err) {
    logger.error('保存备忘录失败:', String(err));
  }
}

function genId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useMemos() {
  const [memos, setMemos] = useState<IMemo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const data = loadMemos();
    setMemos(data);
  }, []);

  const persist = useCallback((updater: (prev: IMemo[]) => IMemo[]) => {
    setMemos((prev) => {
      const next = updater(prev);
      saveMemos(next);
      return next;
    });
  }, []);

  const refreshMemos = useCallback(async () => {
    setLoading(true);
    try {
      setMemos(loadMemos());
    } finally {
      setLoading(false);
    }
  }, []);

  const addMemo = useCallback(
    async (content: string, isImportant = false) => {
      const now = new Date();
      const newMemo: IMemo = {
        id: genId(),
        content,
        isImportant,
        isCompleted: false,
        createTime: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      };
      persist((prev) => [newMemo, ...prev]);
      return newMemo;
    },
    [persist],
  );

  const deleteMemo = useCallback(async (id: string) => {
    persist((prev) => prev.filter((m) => m.id !== id));
  }, [persist]);

  const toggleImportant = useCallback(
    async (id: string) => {
      persist((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isImportant: !m.isImportant } : m)),
      );
    },
    [persist],
  );

  const toggleCompleted = useCallback(
    async (id: string) => {
      persist((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isCompleted: !m.isCompleted } : m)),
      );
    },
    [persist],
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
