import { useState, useMemo, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
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
  Plus,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useSpecialWork } from '@/hooks/use-special-work';
import { useAuth } from '@/hooks/use-auth';
import { getFileColor } from '@/lib/file-type-colors';
import type { ISpecialWork, ISpecialWorkAttachment, SpecialWorkCategory, SpecialWorkStatus } from '@/data/special-work';
import {
  SPECIAL_WORK_STATUS_LABEL, SPECIAL_WORK_STATUS_COLOR,
  SPECIAL_WORK_CATEGORY_LABELS, SPECIAL_WORK_CATEGORY_OPTIONS,
} from '@/data/special-work';
import themeConfig from '@/data/theme.json';
import appConfig from '@/data/app-config.json';

type SortField = 'workTime' | 'endTime' | 'location' | 'applicant' | 'category' | 'status';
type SortOrder = 'asc' | 'desc';

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

export default function SpecialWorkPage() {
  const {
    works, refreshWorks, addWork, updateWork, deleteWork, cycleStatus,
    addAttachment, removeAttachment,
  } = useSpecialWork();
  const { isAdmin } = useAuth();

  // 筛选
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [workStartDate, setWorkStartDate] = useState('');
  const [workEndDate, setWorkEndDate] = useState('');

  // 排序
  const [sortField, setSortField] = useState<SortField>('workTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // 弹窗状态
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ISpecialWork | null>(null);
  const [viewTarget, setViewTarget] = useState<ISpecialWork | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ISpecialWork | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);

  // 表单字段
  const [formCategory, setFormCategory] = useState<SpecialWorkCategory>('hot_work');
  const [formWorkTime, setFormWorkTime] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formApplicant, setFormApplicant] = useState('');
  const [formApprover, setFormApprover] = useState('');
  const [formGuardian, setFormGuardian] = useState('');
  const [formEndTime, setFormEndTime] = useState('');

  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('');
  const pageSize = appConfig.pagination.defaultPageSize;

  // 附件上传 ref
  const attachInputRef = useRef<HTMLInputElement>(null);

  // 统计
  const stats = useMemo(() => {
    const total = works.length;
    const pending = works.filter((w) => w.status === 'pending').length;
    const approved = works.filter((w) => w.status === 'approved').length;
    const completed = works.filter((w) => w.status === 'completed').length;
    return { total, pending, approved, completed };
  }, [works]);

  // 筛选 + 排序
  const filtered = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return works.filter((w) => {
      if (categoryFilter !== 'all' && w.category !== categoryFilter) return false;
      if (workStartDate && w.workTime < workStartDate) return false;
      if (workEndDate && w.workTime > workEndDate + 'T23:59') return false;
      if (kw) {
        const fields = [w.workTime, w.location, w.applicant, w.approver, w.guardian, w.endTime].map((v) => (v || '').toLowerCase());
        if (!fields.some((f) => f.includes(kw))) return false;
      }
      return true;
    });
  }, [works, categoryFilter, searchKeyword, workStartDate, workEndDate]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const va = a[sortField]; const vb = b[sortField];
      if (sortOrder === 'asc') return va > vb ? 1 : -1;
      return va < vb ? 1 : -1;
    });
    return list;
  }, [filtered, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchKeyword, workStartDate, workEndDate, works.length]);

  // ---- 操作函数 ----

  const resetForm = () => {
    setFormCategory('hot_work');
    setFormWorkTime(''); setFormLocation(''); setFormApplicant('');
    setFormApprover(''); setFormGuardian(''); setFormEndTime('');
  };

  const openAdd = () => {
    resetForm();
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (w: ISpecialWork) => {
    setEditTarget(w);
    setFormCategory(w.category);
    setFormWorkTime(w.workTime); setFormLocation(w.location);
    setFormApplicant(w.applicant); setFormApprover(w.approver);
    setFormGuardian(w.guardian); setFormEndTime(w.endTime);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formWorkTime || !formLocation || !formApplicant || !formApprover || !formGuardian || !formEndTime) {
      toast.error('请填写所有必填字段');
      return;
    }
    try {
      if (editTarget) {
        await updateWork(editTarget.id, {
          category: formCategory, workTime: formWorkTime, location: formLocation,
          applicant: formApplicant, approver: formApprover, guardian: formGuardian, endTime: formEndTime,
        });
        toast.success('修改已保存');
      } else {
        await addWork({
          category: formCategory, workTime: formWorkTime, location: formLocation,
          applicant: formApplicant, approver: formApprover, guardian: formGuardian, endTime: formEndTime,
        });
        toast.success('新增成功');
      }
      setFormOpen(false);
      setEditTarget(null);
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWork(deleteTarget.id);
      toast.success('已删除');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    }
  };

  const handleAttachAdd = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !viewTarget) return;
    for (const file of Array.from(e.target.files)) {
      if (file.size > appConfig.fileLimits.hazardAttachmentMaxSize) {
        toast.error(`文件 ${file.name} 超过 10MB，已跳过`);
        continue;
      }
      try {
        const att = await addAttachment(viewTarget.id, file);
        setViewTarget((prev) => prev ? { ...prev, attachments: [...prev.attachments, att] } : null);
      } catch { /* toast in hook */ }
    }
    if (viewTarget) toast.success('附件上传成功');
    e.target.value = '';
  };

  const handleAttachRemove = async (attId: string) => {
    if (!viewTarget) return;
    removeAttachment(viewTarget.id, attId);
    setViewTarget((prev) =>
      prev ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== attId) } : null,
    );
    toast.success('附件已删除');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  // ---- 渲染辅助 ----

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead className="whitespace-nowrap">
      <button onClick={() => handleSort(field)}
        className="flex items-center gap-1 font-medium text-foreground hover:text-primary">
        {label}
        <ArrowUpDown className="size-3.5 text-muted-foreground" />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">特种作业审批</h1>
          <p className="mt-1 text-sm text-muted-foreground">特种作业申请、审批与全流程管理</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="default" className="gap-2" onClick={openAdd}
              style={{ backgroundColor: themeConfig.colors.primary }}>
              <Plus className="size-4" />
              新增作业
            </Button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: '总作业数', value: stats.total, color: 'text-foreground' },
          { label: '待审批', value: stats.pending, color: '', style: { color: SPECIAL_WORK_STATUS_COLOR.pending } },
          { label: '已批准', value: stats.approved, color: '', style: { color: SPECIAL_WORK_STATUS_COLOR.approved } },
          { label: '已完成', value: stats.completed, color: '', style: { color: SPECIAL_WORK_STATUS_COLOR.completed } },
          { label: '审批率', value: `${stats.total > 0 ? Math.round(((stats.approved + stats.completed) / stats.total) * 100) : 0}%`, color: 'text-success' },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold" style={s.style ?? undefined}>{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选区 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Filter className="size-4" />筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="text-xs">开始时间</Label>
              <Input
                type="date"
                value={workStartDate}
                onChange={(e) => setWorkStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">结束时间</Label>
              <Input
                type="date"
                value={workEndDate}
                onChange={(e) => setWorkEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">类别筛选</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {SPECIAL_WORK_CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 min-w-[180px] max-w-[280px]">
              <Label className="text-xs">关键词搜索</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="搜索位置/申请人/审批人..." value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)} className="pl-9 w-full" />
              </div>
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap pb-1">共 {sorted.length} 条记录</div>
          </div>
        </CardContent>
      </Card>

      {/* 列表表格 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="size-5" />作业列表
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap w-16">序号</TableHead>
                  <SortableHeader field="category" label="类别" />
                  <SortableHeader field="workTime" label="作业时间" />
                  <SortableHeader field="location" label="作业部位" />
                  <SortableHeader field="applicant" label="申请人" />
                  <SortableHeader field="approver" label="审批人" />
                  <TableHead className="whitespace-nowrap">监护人</TableHead>
                  <SortableHeader field="endTime" label="结束时间" />
                  <TableHead className="whitespace-nowrap text-center">附件</TableHead>
                  <SortableHeader field="status" label="状态" />
                  <TableHead className="whitespace-nowrap text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center text-muted-foreground">
                      暂无特种作业记录
                    </TableCell>
                  </TableRow>
                ) : paginatedData.map((w, idx) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{(currentPage - 1) * pageSize + idx + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="secondary" className="text-xs">
                        {SPECIAL_WORK_CATEGORY_LABELS[w.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{w.workTime}</TableCell>
                    <TableCell className="whitespace-nowrap">{w.location}</TableCell>
                    <TableCell className="whitespace-nowrap">{w.applicant}</TableCell>
                    <TableCell className="whitespace-nowrap">{w.approver}</TableCell>
                    <TableCell className="whitespace-nowrap">{w.guardian}</TableCell>
                    <TableCell className="whitespace-nowrap">{w.endTime}</TableCell>
                    <TableCell className="text-center">
                      <button onClick={() => setViewTarget(w)}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <Paperclip className="size-4" />
                        <Badge variant="secondary" className="text-xs">{w.attachments.length}</Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      {isAdmin ? (
                        <button type="button" onClick={() => cycleStatus(w.id)}
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-transform hover:scale-105 active:scale-95"
                          style={{ backgroundColor: `${SPECIAL_WORK_STATUS_COLOR[w.status]}20`, color: SPECIAL_WORK_STATUS_COLOR[w.status] }}
                          title={`当前：${SPECIAL_WORK_STATUS_LABEL[w.status]}（点击流转）`}>
                          {SPECIAL_WORK_STATUS_LABEL[w.status]}
                        </button>
                      ) : (
                        <Badge variant="secondary" className="text-xs font-medium cursor-default"
                          style={{ backgroundColor: `${SPECIAL_WORK_STATUS_COLOR[w.status]}20`, color: SPECIAL_WORK_STATUS_COLOR[w.status] }}>
                          {SPECIAL_WORK_STATUS_LABEL[w.status]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => setViewTarget(w)} title="查看详情">
                          <Eye className="size-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(w)} title="编辑">
                              <Pencil className="size-4" />
                            </Button>
                            <AlertDialog open={!!deleteTarget && deleteTarget.id === w.id} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(w)} title="删除">
                                  <Trash2 className="size-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                                  <AlertDialogDescription>确定要删除这条特种作业记录吗？此操作不可撤销。</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setDeleteTarget(null)}>取消</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDelete}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    确认删除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {/* 分页 */}
        {sorted.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3">
            <div className="text-sm text-muted-foreground">共 {sorted.length} 条，每页 {pageSize} 条</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1} className="gap-1">
                <ChevronLeft className="size-4" />上一页
              </Button>
              <div className="text-sm text-foreground">第 <span className="font-medium">{currentPage}</span> / {totalPages} 页</div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages} className="gap-1">
                下一页<ChevronRight className="size-4" />
              </Button>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">跳至</span>
                <Input type="number" value={jumpPage} onChange={(e) => setJumpPage(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') { const n = parseInt(jumpPage, 10); if (!isNaN(n) && n >= 1 && n <= totalPages) { setCurrentPage(n); setJumpPage(''); } }
                  }}
                  min={1} max={totalPages} className="h-8 w-16 text-center text-sm" />
                <span className="text-sm text-muted-foreground">页</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 新增/编辑弹窗 */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) { resetForm(); setEditTarget(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? '编辑特种作业' : '新增特种作业'}</DialogTitle>
            <DialogDescription>请填写完整的作业信息，带 * 为必填项</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>作业类别 *</Label>
              <Select value={formCategory} onValueChange={(v) => setFormCategory(v as SpecialWorkCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPECIAL_WORK_CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>作业时间 *</Label>
                <Input type="datetime-local" value={formWorkTime.replace(' ', 'T')}
                  onChange={(e) => setFormWorkTime(e.target.value.replace('T', ' '))} />
              </div>
              <div className="space-y-2">
                <Label>结束时间 *</Label>
                <Input type="datetime-local" value={formEndTime.replace(' ', 'T')}
                  onChange={(e) => setFormEndTime(e.target.value.replace('T', ' '))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>作业部位 *</Label>
              <Input placeholder="请输入作业部位" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>申请人 *</Label>
                <Input placeholder="申请人姓名" value={formApplicant} onChange={(e) => setFormApplicant(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>审批人 *</Label>
                <Input placeholder="审批人姓名" value={formApprover} onChange={(e) => setFormApprover(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>监护人 *</Label>
                <Input placeholder="监护人姓名" value={formGuardian} onChange={(e) => setFormGuardian(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); setEditTarget(null); }}>取消</Button>
            <Button onClick={handleSave} style={{ backgroundColor: themeConfig.colors.primary }}>
              {editTarget ? '保存修改' : '确认新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看/附件弹窗 */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>作业详情 - {viewTarget?.location}</DialogTitle>
            <DialogDescription className="text-xs">支持查看和上传附件</DialogDescription>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4 py-2">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['类别', SPECIAL_WORK_CATEGORY_LABELS[viewTarget.category]],
                  ['作业时间', viewTarget.workTime],
                  ['结束时间', viewTarget.endTime],
                  ['作业部位', viewTarget.location],
                  ['申请人', viewTarget.applicant],
                  ['审批人', viewTarget.approver],
                  ['监护人', viewTarget.guardian],
                  ['状态',
                    <span key="st" className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: `${SPECIAL_WORK_STATUS_COLOR[viewTarget.status]}20`, color: SPECIAL_WORK_STATUS_COLOR[viewTarget.status] }}>
                      {SPECIAL_WORK_STATUS_LABEL[viewTarget.status]}
                    </span>
                   ],
                ].map(([k, v]) => (
                  <div key={String(k)}><span className="text-muted-foreground">{k}：</span>{v as React.ReactNode}</div>
                ))}
              </div>

              {/* 附件区域 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">附件（{viewTarget.attachments.length}）</Label>
                  {isAdmin && (
                    <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => attachInputRef.current?.click()}>
                      <Upload className="size-3" /> 上传
                    </Button>
                  )}
                </div>
                <input ref={attachInputRef} type="file" multiple accept={appConfig.acceptedFileTypes.hazardAttachment}
                  onChange={handleAttachAdd} className="hidden" />
                {viewTarget.attachments.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-sm rounded-lg border border-dashed">暂无附件</div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {viewTarget.attachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex size-9 items-center justify-center rounded-md bg-muted" style={{ color: getFileColor(att.type) }}>
                            {getFileIcon(att.type)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{att.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(att.size)} · {att.uploadTime}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {att.type.startsWith('image/') && att.url && (
                            <Button size="icon" variant="ghost" className="size-8" onClick={async () => {
                              try {
                                const token = localStorage.getItem(appConfig.storageKeys.token || 'auth_token');
                                const res = await fetch(att.url!, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                const blob = await res.blob();
                                setImagePreview({ url: URL.createObjectURL(blob), name: att.name });
                              } catch { toast.error('预览失败'); }
                            }} title="预览图片"><Eye className="size-4" /></Button>
                          )}
                          {isAdmin && (
                            <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive"
                              onClick={() => handleAttachRemove(att.id)} title="删除附件">
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 图片预览 */}
      <Dialog open={!!imagePreview} onOpenChange={(open) => { if (!open) { URL.revokeObjectURL(imagePreview?.url || ''); setImagePreview(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto p-0">
          {imagePreview && (
            <>
              <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur px-6 py-3 border-b">
                <DialogTitle className="text-sm font-medium truncate max-w-[70%]">{imagePreview.name}</DialogTitle>
                <Button variant="ghost" size="icon" className="size-8"
                  onClick={() => { URL.revokeObjectURL(imagePreview.url); setImagePreview(null); }}>✕</Button>
              </div>
              <div className="flex items-center justify-center p-4 min-h-[200px]">
                <img src={imagePreview.url} alt={imagePreview.name} className="max-w-full max-h-[75vh] object-contain rounded" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
