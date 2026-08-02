// EXPORTS: useHazards
// localStorage 版本：所有数据存储在浏览器本地，不依赖后端 API
// 多设备数据独立（每台浏览器各自存储）

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { type IHazard, type IAttachment, type HazardStatus } from '@/data/hazards';
import hazardConfig from '@/data/hazard-config.json';

const STORAGE_KEY = '__app_safety_hazards';
const STATUS_FLOW: HazardStatus[] = hazardConfig.statusFlow as HazardStatus[];

function loadHazards(): IHazard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as IHazard[];
    return data.map((h) => ({ ...h, attachments: h.attachments ?? [] }));
  } catch {
    return [];
  }
}

function saveHazards(hazards: IHazard[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hazards));
  } catch (err) {
    logger.error('保存隐患数据失败:', String(err));
  }
}

function genId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useHazards() {
  const [hazards, setHazards] = useState<IHazard[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const data = loadHazards();
    setHazards(data);
  }, []);

  const persist = useCallback((updater: (prev: IHazard[]) => IHazard[]) => {
    setHazards((prev) => {
      const next = updater(prev);
      saveHazards(next);
      return next;
    });
  }, []);

  const refreshHazards = useCallback(async () => {
    setLoading(true);
    try {
      const data = loadHazards();
      setHazards(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // 循环切换状态：unfixed -> fixing -> fixed -> unfixed
  const cycleStatus = useCallback(async (id: string) => {
    persist((prev) => {
      const hazard = prev.find((h) => h.id === id);
      if (!hazard) return prev;
      const currentIdx = STATUS_FLOW.indexOf(hazard.status);
      const nextStatus = STATUS_FLOW[(currentIdx + 1) % STATUS_FLOW.length];
      return prev.map((h) => (h.id === id ? { ...h, status: nextStatus } : h));
    });
  }, [persist]);

  // 直接设置状态
  const setStatus = useCallback(async (id: string, status: HazardStatus) => {
    persist((prev) => prev.map((h) => (h.id === id ? { ...h, status } : h)));
  }, [persist]);

  // 兼容旧 API：fixed <-> unfixed
  const toggleFixed = useCallback(async (id: string) => {
    persist((prev) => {
      const hazard = prev.find((h) => h.id === id);
      if (!hazard) return prev;
      const newStatus: HazardStatus = hazard.status === 'fixed' ? 'unfixed' : 'fixed';
      return prev.map((h) => (h.id === id ? { ...h, status: newStatus } : h));
    });
  }, [persist]);

  // 新增隐患
  const addHazard = useCallback(
    async (
      hazard: Omit<IHazard, 'id' | 'status' | 'attachments'> & {
        status?: HazardStatus;
        attachments?: IAttachment[];
      },
    ) => {
      const newHazard: IHazard = {
        id: genId(),
        date: hazard.date,
        location: hazard.location,
        description: hazard.description,
        responsible: hazard.responsible,
        acceptTime: hazard.acceptTime,
        status: hazard.status ?? 'unfixed',
        attachments: hazard.attachments ?? [],
      };
      persist((prev) => [newHazard, ...prev]);
      return newHazard;
    },
    [persist],
  );

  // 批量导入
  const batchAddHazards = useCallback(
    async (
      items: Omit<IHazard, 'id' | 'attachments'>[],
    ): Promise<{ added: IHazard[]; count: number }> => {
      const newHazards: IHazard[] = items.map((item) => ({
        id: genId(),
        date: item.date,
        location: item.location,
        description: item.description,
        responsible: item.responsible,
        acceptTime: item.acceptTime,
        status: item.status,
        attachments: [],
      }));
      persist((prev) => [...newHazards, ...prev]);
      return { added: newHazards, count: newHazards.length };
    },
    [persist],
  );

  // 添加附件（localStorage 版：直接存储 dataUrl）
  const addAttachment = useCallback(
    async (hazardId: string, file: File): Promise<IAttachment> => {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.readAsDataURL(file);
      });
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const attachment: IAttachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl,
        uploadTime: timeStr,
      };
      persist((prev) =>
        prev.map((h) =>
          h.id === hazardId
            ? { ...h, attachments: [...(h.attachments ?? []), attachment] }
            : h,
        ),
      );
      return attachment;
    },
    [persist],
  );

  // 删除附件
  const removeAttachment = useCallback(async (hazardId: string, attachmentId: string) => {
    persist((prev) =>
      prev.map((h) =>
        h.id === hazardId
          ? { ...h, attachments: (h.attachments ?? []).filter((a) => a.id !== attachmentId) }
          : h,
      ),
    );
  }, [persist]);

  // 更新隐患
  const updateHazard = useCallback(
    async (id: string, updates: Partial<Omit<IHazard, 'id'>>) => {
      persist((prev) =>
        prev.map((h) => {
          if (h.id !== id) return h;
          const next: IHazard = { ...h, ...updates };
          if (!updates.attachments) {
            next.attachments = h.attachments;
          }
          return next;
        }),
      );
    },
    [persist],
  );

  // 删除隐患
  const deleteHazard = useCallback(async (id: string) => {
    persist((prev) => prev.filter((h) => h.id !== id));
  }, [persist]);

  // 批量删除
  const batchDeleteHazards = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    persist((prev) => prev.filter((h) => !idSet.has(h.id)));
  }, [persist]);

  return {
    hazards,
    loading,
    refreshHazards,
    toggleFixed,
    cycleStatus,
    setStatus,
    addHazard,
    batchAddHazards,
    addAttachment,
    removeAttachment,
    updateHazard,
    deleteHazard,
    batchDeleteHazards,
  };
}
