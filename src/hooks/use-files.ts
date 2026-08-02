// EXPORTS: useFiles
// localStorage 版本：文件以 dataUrl 形式存储在浏览器本地
// 注意：localStorage 有容量限制（通常 5-10MB），大文件可能存储失败

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { type IFolder, type IFileItem } from '@/data/files';
import appConfig from '@/data/app-config.json';

const FOLDERS_KEY = '__app_safety_folders';
const FILES_KEY = '__app_safety_files';

function loadFolders(): IFolder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) {
      // 首次使用，初始化默认文件夹
      const defaults: IFolder[] = appConfig.defaultFolders.map((f) => ({
        id: f.id,
        name: f.name,
        isDefault: f.isDefault,
        createTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }));
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(raw) as IFolder[];
  } catch {
    return [];
  }
}

function saveFolders(folders: IFolder[]) {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch (err) {
    logger.error('保存文件夹失败:', String(err));
  }
}

function loadFiles(): IFileItem[] {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as IFileItem[];
  } catch {
    return [];
  }
}

function saveFiles(files: IFileItem[]) {
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  } catch (err) {
    logger.error('保存文件列表失败:', String(err));
    throw new Error('存储空间不足，可能文件过大。请删除不需要的文件后重试。');
  }
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useFiles() {
  const [folders, setFolders] = useState<IFolder[]>([]);
  const [files, setFiles] = useState<IFileItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFolders(loadFolders());
    setFiles(loadFiles());
  }, []);

  const persistFolders = useCallback((updater: (prev: IFolder[]) => IFolder[]) => {
    setFolders((prev) => {
      const next = updater(prev);
      saveFolders(next);
      return next;
    });
  }, []);

  const persistFiles = useCallback((updater: (prev: IFileItem[]) => IFileItem[]) => {
    setFiles((prev) => {
      const next = updater(prev);
      saveFiles(next);
      return next;
    });
  }, []);

  const fetchFolders = useCallback(async () => {
    setFolders(loadFolders());
  }, []);

  const fetchFiles = useCallback(async (folderId?: string, keyword?: string) => {
    setLoading(true);
    try {
      let data = loadFiles();
      if (folderId) {
        data = data.filter((f) => f.folderId === folderId);
      }
      if (keyword) {
        const lower = keyword.toLowerCase();
        data = data.filter((f) => f.name.toLowerCase().includes(lower));
      }
      setFiles(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // 新建文件夹
  const addFolder = useCallback(async (name: string): Promise<IFolder> => {
    const now = new Date();
    const newFolder: IFolder = {
      id: genId('folder'),
      name,
      isDefault: false,
      createTime: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
    persistFolders((prev) => [...prev, newFolder]);
    return newFolder;
  }, [persistFolders]);

  // 重命名文件夹
  const renameFolder = useCallback(async (id: string, name: string) => {
    persistFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  }, [persistFolders]);

  // 删除文件夹（同时删除文件夹下的文件）
  const deleteFolder = useCallback(async (id: string) => {
    persistFolders((prev) => prev.filter((f) => f.id !== id));
    persistFiles((prev) => prev.filter((f) => f.folderId !== id));
  }, [persistFolders, persistFiles]);

  // 上传文件（localStorage 版：转为 dataUrl 存储）
  const uploadFile = useCallback(
    async (file: File, folderId: string): Promise<boolean> => {
      try {
        const maxSize = appConfig.fileLimits.safetyFileMaxSize;
        if (file.size > maxSize) {
          logger.error(`文件 ${file.name} 超过大小限制`);
          return false;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.readAsDataURL(file);
        });
        const now = new Date();
        const newFile: IFileItem = {
          id: genId('file'),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl,
          folderId,
          uploadTime: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        };
        persistFiles((prev) => [...prev, newFile]);
        return true;
      } catch (err: any) {
        logger.error('上传文件失败:', String(err?.message ?? err));
        return false;
      }
    },
    [persistFiles],
  );

  // 删除文件
  const deleteFile = useCallback(async (id: string) => {
    persistFiles((prev) => prev.filter((f) => f.id !== id));
  }, [persistFiles]);

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
