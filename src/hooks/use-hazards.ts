// EXPORTS: useHazards
// 后端 API 版本：所有数据通过 src/lib/api.ts 的 api 客户端与后端交互
// api 客户端会自动添加 /api 前缀与 Authorization 头
// 本地 state 用于即时 UI 反馈，权威数据以后端为准

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { api } from '@/lib/api';
import { type IHazard, type IAttachment, type HazardStatus } from '@/data/hazards';
import hazardConfig from '@/data/hazard-config.json';

const STATUS_FLOW: HazardStatus[] = hazardConfig.statusFlow as HazardStatus[];

/** 规范化隐患对象，确保 attachments 字段存在 */
function normalizeHazard(h: Partial<IHazard> | null | undefined): IHazard {
  return {
    id: h?.id ?? '',
    date: h?.date ?? '',
    location: h?.location ?? '',
    description: h?.description ?? '',
    responsible: h?.responsible ?? '',
    acceptTime: h?.acceptTime ?? '',
    status: (h?.status ?? 'unfixed') as HazardStatus,
    attachments: h?.attachments ?? [],
  };
}

export function useHazards() {
  const [hazards, setHazards] = useState<IHazard[]>([]);
  const [loading, setLoading] = useState(false);

  // 挂载时拉取初始数据
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<IHazard[]>('/hazards');
        if (!cancelled) {
          setHazards((data ?? []).map(normalizeHazard));
        }
      } catch (err) {
        console.error('加载隐患数据失败:', err);
        logger.error('加载隐患数据失败:', String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 刷新隐患列表
  const refreshHazards = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<IHazard[]>('/hazards');
      setHazards((data ?? []).map(normalizeHazard));
    } catch (err) {
      console.error('刷新隐患数据失败:', err);
      logger.error('刷新隐患数据失败:', String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 直接设置状态
  const setStatus = useCallback(async (id: string, status: HazardStatus) => {
    // 即时更新本地 state
    setHazards((prev) => prev.map((h) => (h.id === id ? { ...h, status } : h)));
    try {
      await api.post(`/hazards/${id}/status`, { status });
    } catch (err) {
      console.error('设置隐患状态失败:', err);
      logger.error('设置隐患状态失败:', String(err));
      // 失败后回滚，重新拉取权威数据
      try {
        const data = await api.get<IHazard[]>('/hazards');
        setHazards((data ?? []).map(normalizeHazard));
      } catch {
        // ignore rollback error
      }
    }
  }, []);

  // 循环切换状态：unfixed -> fixing -> fixed -> unfixed
  const cycleStatus = useCallback(
    async (id: string) => {
      let nextStatus: HazardStatus | null = null;
      setHazards((prev) =>
        prev.map((h) => {
          if (h.id !== id) return h;
          const currentIdx = STATUS_FLOW.indexOf(h.status);
          nextStatus = STATUS_FLOW[(currentIdx + 1) % STATUS_FLOW.length];
          return { ...h, status: nextStatus };
        }),
      );
      if (!nextStatus) return;
      try {
        await api.post(`/hazards/${id}/status`, { status: nextStatus });
      } catch (err) {
        console.error('循环切换隐患状态失败:', err);
        logger.error('循环切换隐患状态失败:', String(err));
        // 失败后回滚
        try {
          const data = await api.get<IHazard[]>('/hazards');
          setHazards((data ?? []).map(normalizeHazard));
        } catch {
          // ignore rollback error
        }
      }
    },
    [],
  );

  // 兼容旧 API：fixed <-> unfixed
  const toggleFixed = useCallback(async (id: string) => {
    let targetStatus: HazardStatus | null = null;
    setHazards((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        targetStatus = h.status === 'fixed' ? 'unfixed' : 'fixed';
        return { ...h, status: targetStatus };
      }),
    );
    if (!targetStatus) return;
    try {
      await api.post(`/hazards/${id}/status`, { status: targetStatus });
    } catch (err) {
      console.error('切换隐患整改状态失败:', err);
      logger.error('切换隐患整改状态失败:', String(err));
      try {
        const data = await api.get<IHazard[]>('/hazards');
        setHazards((data ?? []).map(normalizeHazard));
      } catch {
        // ignore rollback error
      }
    }
  }, []);

  // 新增隐患
  const addHazard = useCallback(
    async (
      hazard: Omit<IHazard, 'id' | 'status' | 'attachments'> & {
        status?: HazardStatus;
        attachments?: IAttachment[];
      },
    ): Promise<IHazard> => {
      try {
        const body = {
          date: hazard.date,
          location: hazard.location,
          description: hazard.description,
          responsible: hazard.responsible,
          acceptTime: hazard.acceptTime,
          status: hazard.status,
        };
        const created = await api.post<IHazard>('/hazards', body);
        const newHazard = normalizeHazard(created);
        // 即时插入到列表头部
        setHazards((prev) => [newHazard, ...prev]);
        return newHazard;
      } catch (err) {
        console.error('新增隐患失败:', err);
        logger.error('新增隐患失败:', String(err));
        throw err;
      }
    },
    [],
  );

  // 批量导入
  const batchAddHazards = useCallback(
    async (
      items: Omit<IHazard, 'id' | 'attachments'>[],
    ): Promise<{ added: IHazard[]; count: number }> => {
      try {
        const payload = items.map((item) => ({
          date: item.date,
          location: item.location,
          description: item.description,
          responsible: item.responsible,
          acceptTime: item.acceptTime,
          status: item.status,
        }));
        const res = await api.post<{ count: number }>('/hazards/batch-import', {
          items: payload,
        });
        const count = res?.count ?? 0;
        // 批量导入后刷新以获取权威数据
        await refreshHazards();
        return { added: [], count };
      } catch (err) {
        console.error('批量导入隐患失败:', err);
        logger.error('批量导入隐患失败:', String(err));
        throw err;
      }
    },
    [refreshHazards],
  );

  // 添加附件（后端上传，返回带 url 的附件对象）
  const addAttachment = useCallback(
    async (hazardId: string, file: File): Promise<IAttachment> => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const attachment = await api.upload<IAttachment>(
          `/hazards/${hazardId}/attachments`,
          formData,
        );
        const att: IAttachment = {
          id: attachment?.id ?? '',
          name: attachment?.name ?? file.name,
          size: attachment?.size ?? file.size,
          type: attachment?.type ?? (file.type || 'application/octet-stream'),
          dataUrl: attachment?.dataUrl,
          url: attachment?.url,
          uploadTime: attachment?.uploadTime ?? '',
        };
        // 即时更新本地 state
        setHazards((prev) =>
          prev.map((h) =>
            h.id === hazardId
              ? { ...h, attachments: [...(h.attachments ?? []), att] }
              : h,
          ),
        );
        return att;
      } catch (err) {
        console.error('添加附件失败:', err);
        logger.error('添加附件失败:', String(err));
        throw err;
      }
    },
    [],
  );

  // 删除附件
  const removeAttachment = useCallback(
    async (hazardId: string, attachmentId: string) => {
      // 即时更新本地 state
      setHazards((prev) =>
        prev.map((h) =>
          h.id === hazardId
            ? {
                ...h,
                attachments: (h.attachments ?? []).filter(
                  (a) => a.id !== attachmentId,
                ),
              }
            : h,
        ),
      );
      try {
        await api.delete(`/hazards/attachments/${attachmentId}`);
        // 删除后刷新以同步权威数据
        await refreshHazards();
      } catch (err) {
        console.error('删除附件失败:', err);
        logger.error('删除附件失败:', String(err));
        // 失败后回滚
        try {
          await refreshHazards();
        } catch {
          // ignore rollback error
        }
      }
    },
    [refreshHazards],
  );

  // 更新隐患
  const updateHazard = useCallback(
    async (id: string, updates: Partial<Omit<IHazard, 'id'>>) => {
      // 即时更新本地 state
      setHazards((prev) =>
        prev.map((h) => {
          if (h.id !== id) return h;
          const next: IHazard = { ...h, ...updates };
          if (!updates.attachments) {
            next.attachments = h.attachments;
          }
          return next;
        }),
      );
      try {
        await api.put(`/hazards/${id}`, updates);
      } catch (err) {
        console.error('更新隐患失败:', err);
        logger.error('更新隐患失败:', String(err));
        // 失败后回滚
        try {
          await refreshHazards();
        } catch {
          // ignore rollback error
        }
      }
    },
    [refreshHazards],
  );

  // 删除隐患
  const deleteHazard = useCallback(
    async (id: string) => {
      // 即时更新本地 state
      setHazards((prev) => prev.filter((h) => h.id !== id));
      try {
        await api.delete(`/hazards/${id}`);
        // 删除后刷新以同步权威数据
        await refreshHazards();
      } catch (err) {
        console.error('删除隐患失败:', err);
        logger.error('删除隐患失败:', String(err));
        // 失败后回滚
        try {
          await refreshHazards();
        } catch {
          // ignore rollback error
        }
      }
    },
    [refreshHazards],
  );

  // 批量删除
  const batchDeleteHazards = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      // 即时更新本地 state
      setHazards((prev) => prev.filter((h) => !idSet.has(h.id)));
      try {
        await api.post('/hazards/batch-delete', { ids });
        // 批量删除后刷新以同步权威数据
        await refreshHazards();
      } catch (err) {
        console.error('批量删除隐患失败:', err);
        logger.error('批量删除隐患失败:', String(err));
        // 失败后回滚
        try {
          await refreshHazards();
        } catch {
          // ignore rollback error
        }
      }
    },
    [refreshHazards],
  );

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
