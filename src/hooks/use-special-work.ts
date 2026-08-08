// EXPORTS: useSpecialWork
// 特种作业审批：数据获取 / CRUD / 附件 / 审批流转

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { api, getAuthToken } from '@/lib/api';
import {
  type ISpecialWork,
  type ISpecialWorkAttachment,
  type SpecialWorkStatus,
  SPECIAL_WORK_STATUS_FLOW,
} from '@/data/special-work';

function normalizeWork(w: Partial<ISpecialWork> | null | undefined): ISpecialWork {
  return {
    id: w?.id ?? '',
    category: (w?.category ?? 'hot_work') as ISpecialWork['category'],
    workTime: w?.workTime ?? '',
    location: w?.location ?? '',
    applicant: w?.applicant ?? '',
    approver: w?.approver ?? '',
    guardian: w?.guardian ?? '',
    endTime: w?.endTime ?? '',
    status: (w?.status ?? 'pending') as SpecialWorkStatus,
    attachments: w?.attachments ?? [],
    createdAt: w?.createdAt ?? '',
    updatedAt: w?.updatedAt ?? '',
  };
}

export function useSpecialWork() {
  const [works, setWorks] = useState<ISpecialWork[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<ISpecialWork[]>('/special-work');
        if (!cancelled) setWorks((data ?? []).map(normalizeWork));
      } catch (err) {
        console.error('加载特种作业数据失败:', err);
        logger.error('加载特种作业数据失败:', String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshWorks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ISpecialWork[]>('/special-work');
      setWorks((data ?? []).map(normalizeWork));
    } catch (err) {
      console.error('刷新特种作业数据失败:', err);
      logger.error('刷新特种作业数据失败:', String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 新增
  const addWork = useCallback(async (work: Omit<ISpecialWork, 'id' | 'status' | 'attachments' | 'createdAt' | 'updatedAt'>): Promise<ISpecialWork> => {
    try {
      const created = await api.post<ISpecialWork>('/special-work', {
        category: work.category,
        workTime: work.workTime,
        location: work.location,
        applicant: work.applicant,
        approver: work.approver,
        guardian: work.guardian,
        endTime: work.endTime,
      });
      const newWork = normalizeWork(created);
      setWorks((prev) => [newWork, ...prev]);
      return newWork;
    } catch (err) {
      console.error('新增特种作业失败:', err);
      logger.error('新增特种作业失败:', String(err));
      throw err;
    }
  }, []);

  // 更新
  const updateWork = useCallback(async (id: string, updates: Partial<Omit<ISpecialWork, 'id' | 'attachments'>>) => {
    setWorks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    );
    try {
      await api.put(`/special-work/${id}`, updates);
    } catch (err) {
      console.error('更新特种作业失败:', err);
      logger.error('更新特种作业失败:', String(err));
      await refreshWorks();
    }
  }, [refreshWorks]);

  // 删除
  const deleteWork = useCallback(async (id: string) => {
    setWorks((prev) => prev.filter((w) => w.id !== id));
    try {
      await api.delete(`/special-work/${id}`);
      await refreshWorks();
    } catch (err) {
      console.error('删除特种作业失败:', err);
      logger.error('删除特种作业失败:', String(err));
      await refreshWorks();
    }
  }, [refreshWorks]);

  // 审批流转（循环切换）
  const cycleStatus = useCallback(async (id: string) => {
    let nextStatus: SpecialWorkStatus | null = null;
    setWorks((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const currentIdx = SPECIAL_WORK_STATUS_FLOW.indexOf(w.status);
        nextStatus = SPECIAL_WORK_STATUS_FLOW[(currentIdx + 1) % SPECIAL_WORK_STATUS_FLOW.length];
        return { ...w, status: nextStatus };
      }),
    );
    if (!nextStatus) return;
    try {
      await api.post(`/special-work/${id}/status`, { status: nextStatus });
    } catch (err) {
      console.error('审批流转失败:', err);
      logger.error('审批流转失败:', String(err));
      await refreshWorks();
    }
  }, [refreshWorks]);

  // 添加附件（XHR 实现，支持上传进度回调）
  const addAttachment = useCallback(
    async (
      workId: string,
      file: File,
      onProgress?: (pct: number) => void,
    ): Promise<ISpecialWorkAttachment> => {
      try {
        const token = getAuthToken();
        const formData = new FormData();
        formData.append('file', file);
        const url = `/api/special-work/${workId}/attachments`;
        const result = await new Promise<ISpecialWorkAttachment>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', url);
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && onProgress) {
              onProgress(Math.round((ev.loaded / ev.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                resolve({} as ISpecialWorkAttachment);
              }
            } else {
              let msg = '上传失败';
              try {
                const d = JSON.parse(xhr.responseText);
                if (d?.error) msg = d.error;
              } catch { /* ignore */ }
              reject(new Error(msg));
            }
          };
          xhr.onerror = () => reject(new Error('网络连接失败，请检查网络'));
          xhr.send(formData);
        });
        const att: ISpecialWorkAttachment = {
          id: result?.id ?? '',
          name: result?.name ?? file.name,
          size: result?.size ?? file.size,
          type: result?.type ?? (file.type || 'application/octet-stream'),
          url: result?.url,
          uploadTime: result?.uploadTime ?? '',
        };
        setWorks((prev) =>
          prev.map((w) =>
            w.id === workId ? { ...w, attachments: [...(w.attachments ?? []), att] } : w,
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
    async (workId: string, attId: string) => {
      setWorks((prev) =>
        prev.map((w) =>
          w.id === workId
            ? { ...w, attachments: (w.attachments ?? []).filter((a) => a.id !== attId) }
            : w,
        ),
      );
      try {
        await api.delete(`/special-work/attachments/${attId}`);
        await refreshWorks();
      } catch (err) {
        console.error('删除附件失败:', err);
        logger.error('删除附件失败:', String(err));
        await refreshWorks();
      }
    },
    [refreshWorks],
  );

  return {
    works,
    loading,
    refreshWorks,
    addWork,
    updateWork,
    deleteWork,
    cycleStatus,
    addAttachment,
    removeAttachment,
  };
}
