// EXPORTS: useFiles
// 后端 API 版本：文件与文件夹通过 /safety-files 接口管理，存储在服务器端

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { type IFolder, type IFileItem } from '@/data/files';

export function useFiles() {
  const [folders, setFolders] = useState<IFolder[]>([]);
  const [files, setFiles] = useState<IFileItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取文件夹列表
  const fetchFolders = useCallback(async () => {
    try {
      const data = await api.get<IFolder[]>('/safety-files/folders');
      setFolders(data ?? []);
    } catch (err) {
      console.error('获取文件夹列表失败:', err);
    }
  }, []);

  // 获取文件列表（可按文件夹和关键词筛选）
  const fetchFiles = useCallback(async (folderId?: string, keyword?: string) => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (folderId) params.folderId = folderId;
      if (keyword) params.keyword = keyword;
      const data = await api.get<IFileItem[]>('/safety-files/files', params);
      setFiles(data ?? []);
    } catch (err) {
      console.error('获取文件列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化加载：并行获取文件夹和文件列表
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [folderData, fileData] = await Promise.all([
          api.get<IFolder[]>('/safety-files/folders').catch((err) => {
            console.error('获取文件夹列表失败:', err);
            return [] as IFolder[];
          }),
          api.get<IFileItem[]>('/safety-files/files').catch((err) => {
            console.error('获取文件列表失败:', err);
            return [] as IFileItem[];
          }),
        ]);
        if (!mounted) return;
        setFolders(folderData ?? []);
        setFiles(fileData ?? []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 新建文件夹
  const addFolder = useCallback(async (name: string): Promise<IFolder> => {
    try {
      const newFolder = await api.post<IFolder>('/safety-files/folders', { name });
      setFolders((prev) => [...prev, newFolder]);
      return newFolder;
    } catch (err) {
      console.error('新建文件夹失败:', err);
      throw err;
    }
  }, []);

  // 重命名文件夹
  const renameFolder = useCallback(async (id: string, name: string) => {
    try {
      await api.put(`/safety-files/folders/${id}`, { name });
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    } catch (err) {
      console.error('重命名文件夹失败:', err);
      throw err;
    }
  }, []);

  // 删除文件夹（同时刷新文件夹和文件列表）
  const deleteFolder = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/safety-files/folders/${id}`);
        await Promise.all([fetchFolders(), fetchFiles()]);
      } catch (err) {
        console.error('删除文件夹失败:', err);
        throw err;
      }
    },
    [fetchFolders, fetchFiles],
  );

  // 上传文件
  const uploadFile = useCallback(
    async (file: File, folderId: string): Promise<boolean> => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', folderId);
        const newFile = await api.upload<IFileItem>('/safety-files/files/upload', formData);
        setFiles((prev) => [...prev, newFile]);
        return true;
      } catch (err) {
        console.error('上传文件失败:', err);
        return false;
      }
    },
    [],
  );

  // 删除文件
  const deleteFile = useCallback(async (id: string) => {
    try {
      await api.delete(`/safety-files/files/${id}`);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error('删除文件失败:', err);
      throw err;
    }
  }, []);

  return {
    folders,
    files,
    loading,
    fetchFolders,
    fetchFiles,
    addFolder,
    renameFolder,
    deleteFolder,
    uploadFile,
    deleteFile,
  };
}
