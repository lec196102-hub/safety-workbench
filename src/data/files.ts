// EXPORTS: IFileItem, IFolder
// 类型定义（真数据）
// 假数据（mockFolders / mockFiles）已移至 test_data.js，后端就绪后删除该文件即可

export interface IFileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  url?: string;
  folderId: string;
  uploadTime: string;
}

export interface IFolder {
  id: string;
  name: string;
  createTime: string;
  isDefault?: boolean;
}
