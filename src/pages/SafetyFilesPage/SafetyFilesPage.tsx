import { useState, useRef, useMemo, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import {
  FolderPlus,
  Upload,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Trash2,
  Edit3,
  X,
  Download,
  Eye,
  Search,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useFiles } from '@/hooks/use-files';
import { useAuth } from '@/hooks/use-auth';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { Image } from '@/components/ui/image';
import themeConfig from '@/data/theme.json';
import appConfig from '@/data/app-config.json';
import { getFileColor } from '@/lib/file-type-colors';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIcon(type: string, name: string) {
  if (type.startsWith('image/')) return ImageIcon;
  if (type.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    return FileSpreadsheet;
  }
  return FileText;
}

export default function SafetyFilesPage() {
  const { folders, files, fetchFiles, addFolder, renameFolder, deleteFolder, uploadFile, deleteFile } = useFiles();
  const { isAdmin } = useAuth();
  const [activeFolderId, setActiveFolderId] = useState(appConfig.defaultFolders.find(f => f.isDefault)?.id ?? 'default');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 新建文件夹弹窗
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // 重命名弹窗
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState('');
  const [renameName, setRenameName] = useState('');

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);

  // 图片预览
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);

  const defaultFolder = folders.find((f) => f.isDefault);
  const activeFolder = folders.find((f) => f.id === activeFolderId) ?? defaultFolder;

  // 当前文件夹下的文件（支持搜索）
  const filteredFiles = files.filter((f) =>
    searchKeyword.trim() === '' || f.name.toLowerCase().includes(searchKeyword.toLowerCase().trim()),
  );

  // 新建文件夹
  const handleAddFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toast.error('请输入文件夹名称');
      return;
    }
    if (folders.some((f) => f.name === name)) {
      toast.error('文件夹名称已存在');
      return;
    }
    try {
      await addFolder(name);
      toast.success('文件夹创建成功');
      setNewFolderName('');
      setNewFolderOpen(false);
    } catch (err: any) {
      toast.error(err.message || '创建失败');
    }
  };

  // 打开重命名
  const openRename = (id: string, name: string) => {
    setRenameTargetId(id);
    setRenameName(name);
    setRenameOpen(true);
  };

  // 确认重命名
  const handleRename = async () => {
    const name = renameName.trim();
    if (!name) {
      toast.error('请输入文件夹名称');
      return;
    }
    if (folders.some((f) => f.id !== renameTargetId && f.name === name)) {
      toast.error('文件夹名称已存在');
      return;
    }
    try {
      await renameFolder(renameTargetId, name);
      toast.success('重命名成功');
      setRenameOpen(false);
    } catch (err: any) {
      toast.error(err.message || '重命名失败');
    }
  };

  // 确认删除
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'folder') {
        await deleteFolder(deleteConfirm.id);
        if (activeFolderId === deleteConfirm.id) {
          setActiveFolderId(appConfig.defaultFolders.find(f => f.isDefault)?.id ?? 'default');
        }
        toast.success('文件夹已删除，文件已移至默认文件夹');
      } else {
        await deleteFile(deleteConfirm.id);
        toast.success('文件已删除');
      }
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    }
  };

  // 文件上传
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      try {
        const ok = await uploadFile(file, activeFolderId);
        if (ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        logger.error('上传失败:', String(error));
        failCount++;
      }
    }

    setIsUploading(false);
    e.target.value = '';

    if (failCount > 0) {
      toast.warning(`成功上传 ${successCount} 个文件，${failCount} 个失败（存储空间可能不足）`);
    } else {
      toast.success(`成功上传 ${successCount} 个文件`);
    }
  };

  // 预览/下载文件
  const handlePreview = (file: { name: string; url?: string; dataUrl?: string; type: string }) => {
    const fileUrl = file.url || file.dataUrl;
    if (!fileUrl) {
      toast.info('文件暂不可用');
      return;
    }
    if (file.type.startsWith('image/')) {
      setPreviewFile({ name: file.name, url: fileUrl });
    } else {
      // 非图片文件直接下载
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = file.name;
      link.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题区 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">安全资料</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理安全文档、培训资料和检查记录
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setNewFolderOpen(true)}
              >
                <FolderPlus className="size-4" />
                新建文件夹
              </Button>
              <Button
                className="gap-2"
                style={{ backgroundColor: themeConfig.colors.primary }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="size-4" />
                {isUploading ? '上传中...' : '上传文件'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {/* 主体：左文件夹 + 右文件列表 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        {/* 左侧文件夹列表 */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              文件夹
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {folders.map((folder) => {
                const count = files.filter((f) => f.folderId === folder.id).length;
                const isActive = folder.id === activeFolderId;
                return (
                  <div
                    key={folder.id}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/50 text-foreground'
                    }`}
                    onClick={() => setActiveFolderId(folder.id)}
                  >
                    <FolderOpen className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{folder.name}</span>
                    <span className="text-xs text-muted-foreground">{count}</span>
                    {!folder.isDefault && isAdmin && (
                       <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRename(folder.id, folder.name);
                          }}
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({ type: 'folder', id: folder.id, name: folder.name });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 右侧文件列表 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{activeFolder?.name ?? '文件列表'}</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {filteredFiles.length} 个文件
              </Badge>
            </div>
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索文件名"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted/50">
                  <FolderOpen className="size-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">暂无文件</p>
                 <p className="mt-1 text-xs text-muted-foreground">
                   {isAdmin ? '点击右上角「上传文件」按钮添加文件' : '暂无文件'}
                 </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                      <th className="whitespace-nowrap px-4 py-3">文件名</th>
                      <th className="whitespace-nowrap px-4 py-3">类型</th>
                      <th className="whitespace-nowrap px-4 py-3">大小</th>
                      <th className="whitespace-nowrap px-4 py-3">上传时间</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((file) => {
                      const Icon = getFileIcon(file.type, file.name);
                      const color = getFileColor(file.type, file.name);
                      const isImage = file.type.startsWith('image/');
                      return (
                        <tr
                          key={file.id}
                          className="border-b border-border/60 transition-colors hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                                style={{ backgroundColor: `${color}15`, color }}
                              >
                                <Icon className="size-4.5" />
                              </div>
                              <span className="truncate font-medium text-foreground">
                                {file.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {isImage ? '图片' : file.type.split('/').pop() || '文件'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground tabular-nums">
                            {formatSize(file.size)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {file.uploadTime}
                          </td>
                           <td className="px-4 py-3 text-right">
                             <div className="inline-flex items-center gap-1">
                               <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-8 w-8"
                                 onClick={() => handlePreview(file)}
                               >
                                 {isImage ? <Eye className="size-4" /> : <Download className="size-4" />}
                               </Button>
                               {isAdmin && (
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   className="h-8 w-8 text-destructive"
                                   onClick={() =>
                                     setDeleteConfirm({ type: 'file', id: file.id, name: file.name })
                                   }
                                 >
                                   <Trash2 className="size-4" />
                                 </Button>
                               )}
                             </div>
                           </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 新建文件夹弹窗 */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>输入文件夹名称以创建新的资料分类</DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="请输入文件夹名称"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddFolder();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              取消
            </Button>
            <Button style={{ backgroundColor: themeConfig.colors.primary }} onClick={handleAddFolder}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名弹窗 */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重命名文件夹</DialogTitle>
            <DialogDescription>修改文件夹的显示名称</DialogDescription>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            placeholder="请输入新名称"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button style={{ backgroundColor: themeConfig.colors.primary }} onClick={handleRename}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'folder'
                ? `确定要删除文件夹「${deleteConfirm.name}」吗？文件夹内的文件将被移至默认文件夹。`
                : `确定要删除文件「${deleteConfirm?.name}」吗？此操作不可撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 图片预览 */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={() => setPreviewFile(null)}
            >
              <X className="size-5" />
            </Button>
             {previewFile && (
               <Image
                 src={previewFile.url}
                 alt={previewFile.name}
                 className="max-h-[80vh] w-auto rounded-lg object-contain"
               />
             )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
