import { useState, useMemo, useRef, useEffect, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Eye,
  Trash2,
  Image,
  File,
  FileText as FileTextIcon,
  FileSpreadsheet as FileSpreadsheetIcon,
  Pencil,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import ExcelImportDialog from '@/components/ExcelImportDialog';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useHazards } from '@/hooks/use-hazards';
import { useAuth } from '@/hooks/use-auth';
import { exportToExcel, exportToCsv } from '@/lib/export-table';
import { getFileColor } from '@/lib/file-type-colors';
import type { IHazard, IAttachment } from '@/data/hazards';
import { STATUS_LABEL, STATUS_COLOR } from '@/data/hazards';
import themeConfig from '@/data/theme.json';
import appConfig from '@/data/app-config.json';
import excelConfig from '@/data/excel-config.json';

type SortField = 'date' | 'location' | 'responsible' | 'acceptTime';
type SortOrder = 'asc' | 'desc';
type EditableField = 'date' | 'location' | 'description' | 'responsible' | 'acceptTime';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image className="size-4" />;
  if (type.includes('pdf')) return <FileTextIcon className="size-4" />;
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv'))
    return <FileSpreadsheetIcon className="size-4" />;
  return <File className="size-4" />;
}

export default function HazardSummaryPage() {
  const {
    hazards,
    refreshHazards,
    cycleStatus,
    setStatus,
    removeAttachment,
    addAttachment,
    updateHazard,
    deleteHazard,
    batchDeleteHazards,
    addHazard,
    batchAddHazards,
  } = useHazards();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [startDate, setStartDate] = useState(searchParams.get('start') || '');
  const [endDate, setEndDate] = useState(searchParams.get('end') || '');
  // 关键词以 URL 为唯一数据源（避免与侧边栏全局搜索双源冲突）
  const searchKeyword = searchParams.get('search') || '';
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHazard, setPreviewHazard] = useState<IHazard | null>(null);
  // 图片预览（带认证的 blob URL）
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editField, setEditField] = useState<EditableField | null>(null);
  const [editHazard, setEditHazard] = useState<IHazard | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<IHazard | null>(null);
  const previewFileInputRef = useRef<HTMLInputElement>(null);

  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('');
  const pageSize = appConfig.pagination.defaultPageSize;

  // 批量选择
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  // 汇总统计（三态）
  const stats = useMemo(() => {
    const total = hazards.length;
    const unfixed = hazards.filter((h) => h.status === 'unfixed').length;
    const fixing = hazards.filter((h) => h.status === 'fixing').length;
    const fixed = hazards.filter((h) => h.status === 'fixed').length;
    const rate = total > 0 ? Math.round((fixed / total) * 100) : 0;
    return { total, unfixed, fixing, fixed, rate };
  }, [hazards]);

  // 筛选
  const filtered = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return hazards.filter((h) => {
      if (statusFilter !== 'all' && h.status !== statusFilter) return false;
      if (startDate && h.date < startDate) return false;
      if (endDate && h.date > endDate) return false;
      if (kw) {
        const fields = [h.date, h.location, h.description, h.responsible, h.acceptTime || ''].map((v) => (v || '').toLowerCase());
        if (!fields.some((f) => f.includes(kw))) return false;
      }
      return true;
    });
  }, [hazards, statusFilter, startDate, endDate, searchKeyword]);

  // 排序
  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (sortOrder === 'asc') {
        return va > vb ? 1 : -1;
      }
      return va < vb ? 1 : -1;
    });
    return list;
  }, [filtered, sortField, sortOrder]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage]);

  // 筛选或数据变化时重置到第一页并清空选择
  // 注意：searchKeyword 已是 URL 派生值，不再在此回写，否则会与侧边栏搜索产生双源冲突
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    // 同步 URL 筛选参数（保留 search 参数不动）
    const params = new URLSearchParams(searchParams);
    if (statusFilter !== 'all') params.set('status', statusFilter); else params.delete('status');
    if (startDate) params.set('start', startDate); else params.delete('start');
    if (endDate) params.set('end', endDate); else params.delete('end');
    setSearchParams(params, { replace: true });
  }, [statusFilter, startDate, endDate, hazards.length]);

  // 批量选择
  const allCurrentPageSelected =
    paginatedData.length > 0 && paginatedData.every((h) => selectedIds.has(h.id));
  const someCurrentPageSelected =
    paginatedData.some((h) => selectedIds.has(h.id)) && !allCurrentPageSelected;

  const toggleSelectAll = () => {
    if (allCurrentPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedData.forEach((h) => next.delete(h.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedData.forEach((h) => next.add(h.id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await batchDeleteHazards(Array.from(selectedIds));
      toast.success(`已删除 ${selectedIds.size} 条隐患`);
      setSelectedIds(new Set());
      setBatchDeleteOpen(false);
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handlePreview = (hazard: IHazard) => {
    setPreviewHazard(hazard);
    setPreviewOpen(true);
  };

  const handlePreviewAddFile = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && previewHazard && e.target.files.length > 0) {
      const hazardId = previewHazard.id;
      try {
        for (let i = 0; i < e.target.files.length; i++) {
          const file = e.target.files[i];
          if (file.size > appConfig.fileLimits.hazardAttachmentMaxSize) {
            toast.error(`文件 ${file.name} 超过 10MB，已跳过`);
            continue;
          }
          const att = await addAttachment(hazardId, file);
          setPreviewHazard((prev) =>
            prev ? { ...prev, attachments: [...prev.attachments, att] } : null,
          );
        }
        toast.success('附件上传成功');
      } catch (err: any) {
        toast.error(err.message || '上传失败');
      } finally {
        e.target.value = '';
      }
    }
  };

  const handlePreviewRemoveAttachment = (attId: string) => {
    if (previewHazard) {
      removeAttachment(previewHazard.id, attId);
      setPreviewHazard((prev) =>
        prev
          ? {
              ...prev,
              attachments: prev.attachments.filter((a) => a.id !== attId),
            }
          : null,
      );
      toast.success('附件已删除');
    }
  };

  // 行内编辑
  const openEdit = (hazard: IHazard, field: EditableField) => {
    setEditHazard(hazard);
    setEditField(field);
    setEditValue(hazard[field]);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editHazard || !editField) return;
    // 验收时间允许为空（默认回填记录日期），其他字段不能为空
    if (editField !== 'acceptTime' && !editValue.trim()) {
      toast.error('内容不能为空');
      return;
    }
    try {
      await updateHazard(editHazard.id, { [editField]: editValue.trim() });
      toast.success('修改已保存');
      setEditOpen(false);
      setEditHazard(null);
      setEditField(null);
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteHazard(deleteTarget.id);
        toast.success('隐患已删除');
        setDeleteTarget(null);
      } catch (err: any) {
        toast.error(err.message || '删除失败');
      }
    }
  };

  const handleExportExcel = () => {
    exportToExcel(sorted, excelConfig.exportNames.hazardSummary);
    toast.success('Excel 导出成功');
  };

  const handleExportCsv = () => {
    exportToCsv(sorted, excelConfig.exportNames.hazardSummary);
    toast.success('CSV 导出成功');
  };

  const [importOpen, setImportOpen] = useState(false);

  const handleBatchImport = async (
    items: Omit<IHazard, 'id' | 'attachments'>[],
    _stats: { unfixed: number; fixing: number; fixed: number; total: number },
  ) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const validItems: Omit<IHazard, 'id' | 'attachments'>[] = [];
    let failCount = 0;

    items.forEach((item) => {
      try {
        // 必填字段非空校验
        if (!item.date?.trim() || !item.location?.trim() ||
            !item.description?.trim() || !item.responsible?.trim()) {
          failCount++;
          return;
        }
        // 日期格式合法性校验
        if (!dateRegex.test(item.date) || isNaN(Date.parse(item.date))) {
          failCount++;
          return;
        }
        if (item.acceptTime && (!dateRegex.test(item.acceptTime) || isNaN(Date.parse(item.acceptTime)))) {
          failCount++;
          return;
        }
        validItems.push(item);
      } catch {
        failCount++;
      }
    });

    if (validItems.length === 0) {
      toast.error('未成功导入任何数据，请检查文件内容');
      return;
    }

    const { count } = await batchAddHazards(validItems);

    const importedUnfixed = validItems.filter((i) => i.status === 'unfixed').length;
    const importedFixing = validItems.filter((i) => i.status === 'fixing').length;
    const importedFixed = validItems.filter((i) => i.status === 'fixed').length;

    // 关闭导入弹窗
    setImportOpen(false);

    const baseMsg = `成功导入 ${count} 条：未整改 ${importedUnfixed} 条，正在整改 ${importedFixing} 条，已整改 ${importedFixed} 条`;
    if (failCount > 0) {
      toast.warning(`${baseMsg}，${failCount} 条因数据不合法已跳过`);
    } else {
      toast.success(baseMsg);
    }
  };

  const fieldLabels: Record<EditableField, string> = {
    date: '日期',
    location: '位置',
    description: '问题描述',
    responsible: '责任人',
    acceptTime: '验收时间',
  };

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead className="whitespace-nowrap">
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 font-medium text-foreground hover:text-primary"
      >
        {label}
        <ArrowUpDown className="size-3.5 text-muted-foreground" />
      </button>
    </TableHead>
  );

  const EditableCell = ({
    hazard,
    field,
    truncate = false,
  }: {
    hazard: IHazard;
    field: EditableField;
    truncate?: boolean;
  }) => {
    if (!isAdmin) {
      return (
        <span
          className={
            truncate ? 'max-w-[480px] line-clamp-2' : 'whitespace-nowrap'
          }
        >
          {hazard[field]}
        </span>
      );
    }
    return (
      <button
        onClick={() => openEdit(hazard, field)}
        className="group flex w-full items-center gap-1.5 text-left hover:text-primary"
      >
        <span
          className={
            truncate ? 'max-w-[480px] line-clamp-2' : 'whitespace-nowrap'
          }
        >
          {hazard[field]}
        </span>
        <Pencil className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground" />
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">隐患汇总</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            全量隐患数据汇总与多维度筛选
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="size-4" />
                导出表格
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
                <FileSpreadsheet className="size-4 text-green-600" />
                导出为 Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCsv} className="gap-2">
                <FileText className="size-4 text-blue-600" />
                导出为 CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isAdmin && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-4" />
              批量导入
            </Button>
          )}
        </div>
      </div>

      {/* 汇总统计卡片 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总隐患数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {stats.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              未整改
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: STATUS_COLOR.unfixed }}>
              {stats.unfixed}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              正在整改
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: STATUS_COLOR.fixing }}>
              {stats.fixing}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已整改
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: STATUS_COLOR.fixed }}>
              {stats.fixed}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              整改率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {stats.rate}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="text-xs">开始日期</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">结束日期</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">整改状态</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                 <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="unfixed">未整改</SelectItem>
                    <SelectItem value="fixing">正在整改</SelectItem>
                    <SelectItem value="fixed">已整改</SelectItem>
                  </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 min-w-[180px] max-w-[280px]">
              <Label className="text-xs">关键词搜索</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="搜索位置/描述/责任人..."
                  value={searchKeyword}
                  onChange={(e) => {
                    const params = new URLSearchParams(searchParams);
                    const v = e.target.value;
                    if (v.trim()) params.set('search', v);
                    else params.delete('search');
                    setSearchParams(params, { replace: true });
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-full"
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              共 {sorted.length} 条记录
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 汇总表格 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">隐患汇总表</CardTitle>
          {isAdmin && (
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <span className="text-sm text-muted-foreground">
                已选 <span className="font-medium text-foreground">{selectedIds.size}</span> 条
              </span>
            )}
            <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedIds.size === 0}
                  className="gap-2"
                >
                  <Trash2 className="size-4" />
                  批量删除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认批量删除</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定删除选中的 {selectedIds.size} 条隐患吗？此操作不可撤销。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setBatchDeleteOpen(false)}>
                    取消
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBatchDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    确认删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                 <TableRow>
                   {isAdmin && (
                   <TableHead className="whitespace-nowrap w-12">
                     <Checkbox
                       checked={allCurrentPageSelected}
                       onCheckedChange={toggleSelectAll}
                       aria-label={allCurrentPageSelected ? '取消全选' : '全选当前页'}
                       data-state={someCurrentPageSelected ? 'indeterminate' : undefined}
                     />
                   </TableHead>
                   )}
                   <TableHead className="whitespace-nowrap w-16">序号</TableHead>
                  <SortableHeader field="date" label="日期" />
                  <SortableHeader field="location" label="位置" />
                  <TableHead className="whitespace-nowrap">问题描述</TableHead>
                  <SortableHeader field="responsible" label="责任人" />
                  <SortableHeader field="acceptTime" label="验收时间" />
                  <TableHead className="whitespace-nowrap text-center">
                    附件
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    整改状态
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                     <TableCell
                       colSpan={isAdmin ? 10 : 8}
                       className="py-12 text-center text-muted-foreground"
                     >
                      暂无符合条件的隐患记录
                    </TableCell>
                  </TableRow>
                ) : (
                    paginatedData.map((h: IHazard, index: number) => (
                     <TableRow key={h.id}>
                       {isAdmin && (
                       <TableCell>
                         <Checkbox
                           checked={selectedIds.has(h.id)}
                           onCheckedChange={() => toggleSelectOne(h.id)}
                           aria-label="选择此条"
                         />
                       </TableCell>
                       )}
                       <TableCell className="font-medium">
                         {(currentPage - 1) * pageSize + index + 1}
                       </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <EditableCell hazard={h} field="date" />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <EditableCell hazard={h} field="location" />
                      </TableCell>
                      <TableCell>
                        <EditableCell hazard={h} field="description" truncate />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <EditableCell hazard={h} field="responsible" />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <EditableCell hazard={h} field="acceptTime" />
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => handlePreview(h)}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <Paperclip className="size-4" />
                          <Badge variant="secondary" className="text-xs">
                            {h.attachments.length}
                          </Badge>
                        </button>
                      </TableCell>
                       <TableCell className="text-center">
                         {isAdmin ? (
                           <button
                             type="button"
                             onClick={() => cycleStatus(h.id)}
                             className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-transform hover:scale-105 active:scale-95"
                             style={{
                               backgroundColor: `${STATUS_COLOR[h.status]}20`,
                               color: STATUS_COLOR[h.status],
                             }}
                             title="点击切换状态：未整改 → 正在整改 → 已整改"
                           >
                             {STATUS_LABEL[h.status]}
                           </button>
                         ) : (
                           <Badge
                             variant="secondary"
                             className="text-xs font-medium cursor-default"
                             style={{
                               backgroundColor: `${STATUS_COLOR[h.status]}20`,
                               color: STATUS_COLOR[h.status],
                             }}
                           >
                             {STATUS_LABEL[h.status]}
                           </Badge>
                         )}
                       </TableCell>
                       {isAdmin && (
                       <TableCell className="text-center">
                         <div className="flex items-center justify-center gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(h)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除这条隐患记录吗？此操作不可撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel
                                  onClick={() => setDeleteTarget(null)}
                                >
                                  取消
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDelete}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  确认删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                         </div>
                       </TableCell>
                       )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {sorted.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3">
            <div className="text-sm text-muted-foreground">
              共 {sorted.length} 条，每页 {pageSize} 条
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="gap-1"
              >
                <ChevronLeft className="size-4" />
                上一页
              </Button>
              <div className="text-sm text-foreground">
                第 <span className="font-medium">{currentPage}</span> / {totalPages} 页
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="gap-1"
              >
                下一页
                <ChevronRight className="size-4" />
              </Button>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">跳至</span>
                <Input
                  type="number"
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      const n = parseInt(jumpPage, 10);
                      if (!isNaN(n) && n >= 1 && n <= totalPages) {
                        setCurrentPage(n);
                        setJumpPage('');
                      }
                    }
                  }}
                  min={1}
                  max={totalPages}
                  className="h-8 w-16 text-center text-sm"
                />
                <span className="text-sm text-muted-foreground">页</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 附件预览弹窗 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              附件列表 - {previewHazard?.location}
            </DialogTitle>
            <DialogDescription className="text-xs">
              支持上传和删除附件，数据自动保存
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* 上传区域 */}
            <div
              onClick={() => previewFileInputRef.current?.click()}
              className="cursor-pointer rounded-lg border-2 border-dashed border-border p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <Upload className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-1 text-xs font-medium text-foreground">
                点击添加附件
              </p>
              <input
                ref={previewFileInputRef}
                type="file"
                multiple
                accept={appConfig.acceptedFileTypes.hazardAttachment}
                onChange={handlePreviewAddFile}
                className="hidden"
              />
            </div>
            {previewHazard && previewHazard.attachments.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                暂无附件
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {previewHazard?.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex size-10 items-center justify-center rounded-md bg-muted"
                        style={{ color: getFileColor(att.type) }}
                      >
                        {getFileIcon(att.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {att.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(att.size)} · {att.uploadTime}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {att.type.startsWith('image/') && (att.url || att.dataUrl) && (
                         <Button
                           size="icon"
                           variant="ghost"
                           className="size-8"
                           onClick={async () => {
                             try {
                               const token = localStorage.getItem(appConfig.storageKeys.token || 'auth_token');
                               const res = await fetch(att.url || att.dataUrl || '', {
                                 headers: token ? { Authorization: `Bearer ${token}` } : {},
                               });
                               if (!res.ok) throw new Error(`HTTP ${res.status}`);
                               const blob = await res.blob();
                               const url = URL.createObjectURL(blob);
                               setImagePreview({ url, name: att.name });
                             } catch (e) {
                               toast.error('预览失败，请重试');
                             }
                           }}
                           title="预览图片"
                         >
                           <Eye className="size-4" />
                         </Button>
                       )}
                      {(att.url || att.dataUrl) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem(appConfig.storageKeys.token || 'auth_token');
                              const res = await fetch(att.url || att.dataUrl || '', {
                                headers: token ? { Authorization: `Bearer ${token}` } : {},
                              });
                              if (!res.ok) throw new Error(`HTTP ${res.status}`);
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              const ext = (att.url || att.dataUrl || '').match(/\.[0-9a-z]+$/i)?.[0] || '';
                              const safeName = att.name?.replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_') || `download${ext}`;
                              a.download = safeName;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              setTimeout(() => URL.revokeObjectURL(url), 1000);
                            } catch (e) {
                              toast.error('下载失败，请重试');
                            }
                          }}
                          title="下载附件"
                        >
                          <Download className="size-4" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => handlePreviewRemoveAttachment(att.id)}
                          title="删除附件"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 图片预览弹窗（带认证） */}
      <Dialog open={!!imagePreview} onOpenChange={(open) => { if (!open) { URL.revokeObjectURL(imagePreview?.url || ''); setImagePreview(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto p-0">
          {imagePreview && (
            <>
              <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur px-6 py-3 border-b">
                <DialogTitle className="text-sm font-medium truncate max-w-[70%]">
                  {imagePreview.name}
                </DialogTitle>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => { URL.revokeObjectURL(imagePreview.url); setImagePreview(null); }}>
                  ✕
                </Button>
              </div>
              <div className="flex items-center justify-center p-4 min-h-[200px]">
                <img
                  src={imagePreview.url}
                  alt={imagePreview.name}
                  className="max-w-full max-h-[75vh] object-contain rounded"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 字段编辑弹窗 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑{editField ? fieldLabels[editField] : ''}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {editField === 'description' ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={4}
                placeholder="请输入问题描述"
                autoFocus
              />
            ) : editField === 'date' || editField === 'acceptTime' ? (
              <div className="space-y-2">
                <Input
                  type="date"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                {editField === 'acceptTime' && editValue && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setEditValue('')}
                  >
                    <X className="size-3" />
                    清除验收时间
                  </Button>
                )}
              </div>
            ) : (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={`请输入${editField ? fieldLabels[editField] : ''}`}
                autoFocus
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditHazard(null);
                setEditField(null);
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleSaveEdit}
              style={{ backgroundColor: themeConfig.colors.primary }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量导入弹窗 */}
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleBatchImport}
      />
    </div>
  );
}
