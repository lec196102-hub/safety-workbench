import { useState, useMemo, useRef, type DragEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Calendar,
  ArrowUpDown,
  Paperclip,
  Download,
  X,
  FileText,
  Image,
  FileSpreadsheet,
  File as FileIcon,
  Upload,
  Trash2,
  Eye,
  Pencil,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '@/hooks/use-auth';
import type { EChartsOption } from 'echarts';
import { Button } from '@/components/ui/button';
import ExcelImportDialog from '@/components/ExcelImportDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
import { useAi } from '@/hooks/use-ai';
import { exportToExcel, exportToCsv } from '@/lib/export-table';
import { getFileColor } from '@/lib/file-type-colors';
import type { IHazard, IAttachment, HazardStatus } from '@/data/hazards';
import { STATUS_LABEL, STATUS_COLOR } from '@/data/hazards';
import themeConfig from '@/data/theme.json';
import chartConfig from '@/data/chart-config.json';
import appConfig from '@/data/app-config.json';
import excelConfig from '@/data/excel-config.json';
import hazardConfig from '@/data/hazard-config.json';
import { formTestDefaults } from '@/data/test_data';

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
  if (type.includes('pdf')) return <FileText className="size-4" />;
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv'))
    return <FileSpreadsheet className="size-4" />;
  return <FileIcon className="size-4" />;
}

export default function DailyHazardsPage() {
  const {
    hazards,
    refreshHazards,
    cycleStatus,
    setStatus,
    addHazard,
    batchAddHazards,
    removeAttachment,
    addAttachment,
    updateHazard,
    deleteHazard,
  } = useHazards();
  const { isAdmin } = useAuth();
  const { aiTrendData, aiLoading, generateTrends, clearAiTrend } = useAi();
  const [useAiData, setUseAiData] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unfixed' | 'fixing'>('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHazard, setPreviewHazard] = useState<IHazard | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editField, setEditField] = useState<EditableField | null>(null);
  const [editHazard, setEditHazard] = useState<IHazard | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<IHazard | null>(null);

  // 新增隐患表单
  const [formData, setFormData] = useState({
    date: formTestDefaults.date,
    location: '',
    description: '',
    responsible: '',
    acceptTime: formTestDefaults.acceptTime,
    status: 'unfixed' as HazardStatus,
  });
  const [newAttachments, setNewAttachments] = useState<IAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewFileInputRef = useRef<HTMLInputElement>(null);

  // 按日期范围 + 状态筛选（只显示未整改和正在整改，支持子状态筛选）
  const filteredHazards = useMemo(() => {
    return hazards.filter((h) => {
      if (h.status !== 'unfixed' && h.status !== 'fixing') return false;
      if (statusFilter !== 'all' && h.status !== statusFilter) return false;
      if (startDate && h.date < startDate) return false;
      if (endDate && h.date > endDate) return false;
      return true;
    });
  }, [hazards, statusFilter, startDate, endDate]);

  // 排序
  const sortedHazards = useMemo(() => {
    const list = [...filteredHazards];
    list.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (sortOrder === 'asc') {
        return va > vb ? 1 : -1;
      }
      return va < vb ? 1 : -1;
    });
    return list;
  }, [filteredHazards, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 月度统计（基于全量隐患数据，AI 数据优先）
  const monthlyStats = useMemo(() => {
    if (useAiData && aiTrendData) {
      return aiTrendData.monthlyStats;
    }
    const total = hazards.length;
    const unfixed = hazards.filter((h) => h.status === 'unfixed').length;
    const fixing = hazards.filter((h) => h.status === 'fixing').length;
    const fixed = hazards.filter((h) => h.status === 'fixed').length;
    const rate = total > 0 ? Math.round((fixed / total) * 100) : 0;
    return { total, unfixed, fixing, fixed, rate };
  }, [hazards, useAiData, aiTrendData]);

  // 月度趋势数据（基于实际隐患日期按天统计，AI 数据优先）
  const monthlyTrendData = useMemo(() => {
    if (useAiData && aiTrendData) {
      return aiTrendData.monthlyTrend;
    }
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: string[] = [];
    const counts: number[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(`${i}号`);
      const dateStr = `${selectedMonth}-${String(i).padStart(2, '0')}`;
      const count = hazards.filter((h) => h.date === dateStr).length;
      counts.push(count);
    }
    return { days, counts };
  }, [hazards, selectedMonth, useAiData, aiTrendData]);

  // 年度趋势数据（基于实际隐患日期按月统计，AI 数据优先）
  const yearlyTrendData = useMemo(() => {
    if (useAiData && aiTrendData) {
      return aiTrendData.yearlyTrend;
    }
    const months: string[] = [];
    const counts: number[] = [];
    for (let i = 1; i <= 12; i++) {
      months.push(`${i}月`);
      const monthPrefix = `${selectedYear}-${String(i).padStart(2, '0')}`;
      const count = hazards.filter((h) => h.date.startsWith(monthPrefix)).length;
      counts.push(count);
    }
    return { months, counts };
  }, [hazards, selectedYear, useAiData, aiTrendData]);

  const monthlyTrendOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: monthlyTrendData.days,
      boundaryGap: false,
      axisLine: { lineStyle: { color: chartConfig.axisLineColor } },
      axisLabel: { color: chartConfig.axisLabelColor, fontSize: 10, interval: 2 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: chartConfig.splitLineColor } },
      axisLabel: { color: chartConfig.axisLabelColor, fontSize: 12 },
    },
    series: [
      {
        name: '隐患数量',
        type: 'line',
        data: monthlyTrendData.counts,
        smooth: true,
        lineStyle: { color: chartConfig.seriesColors.line, width: 3 },
        itemStyle: { color: chartConfig.seriesColors.line },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: chartConfig.seriesColors.areaGradient1 },
              { offset: 1, color: chartConfig.seriesColors.areaGradient2 },
            ],
          },
        },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  };

  const yearlyTrendOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: yearlyTrendData.months,
      axisLine: { lineStyle: { color: chartConfig.axisLineColor } },
      axisLabel: { color: chartConfig.axisLabelColor, fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: chartConfig.splitLineColor } },
      axisLabel: { color: chartConfig.axisLabelColor, fontSize: 12 },
    },
    series: [
      {
        name: '隐患数量',
        type: 'bar',
        data: yearlyTrendData.counts,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: chartConfig.seriesColors.barGradient1 },
              { offset: 1, color: chartConfig.seriesColors.barGradient2 },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: '50%',
      },
    ],
  };

  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    setSyncing(true);
    try {
      await refreshHazards();
      toast.success('数据已同步');
    } catch {
      toast.error('同步失败，请检查网络');
    } finally {
      setSyncing(false);
    }
  };

  // AI 趋势分析生成
  const handleAiGenerate = async () => {
    try {
      await generateTrends(hazards, selectedMonth, selectedYear);
      setUseAiData(true);
      toast.success('AI 趋势分析已生成');
    } catch (err: any) {
      toast.error(err.message || 'AI 分析失败，请稍后重试');
    }
  };

  const handleClearAi = () => {
    setUseAiData(false);
    clearAiTrend();
    toast.info('已恢复本地数据');
  };

  // 处理文件上传（通用函数）
  const processFilesToAttachments = (
    files: FileList | File[],
    onAdd: (att: IAttachment) => void,
  ) => {
    const fileArray = Array.from(files);
    const maxSize = appConfig.fileLimits.hazardAttachmentMaxSize;
    let added = 0;

    fileArray.forEach((file) => {
      if (file.size > maxSize) {
        toast.error(`文件 ${file.name} 超过 10MB，已跳过`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const attachment: IAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl: (e.target?.result as string) || '',
          uploadTime: timeStr,
        };
        onAdd(attachment);
      };
      reader.readAsDataURL(file);
      added++;
    });

    if (added > 0) {
      toast.success(`已添加 ${added} 个附件`);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFilesToAttachments(e.target.files, (att) =>
        setNewAttachments((prev) => [...prev, att]),
      );
      e.target.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFilesToAttachments(e.dataTransfer.files, (att) =>
        setNewAttachments((prev) => [...prev, att]),
      );
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeNewAttachment = (id: string) => {
    setNewAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const [addingHazard, setAddingHazard] = useState(false);
  const handleAddHazard = async () => {
    if (!formData.location || !formData.description || !formData.responsible) {
      toast.error('请填写完整信息');
      return;
    }
    setAddingHazard(true);
    try {
      const newHazard = await addHazard({
        ...formData,
      });
      // 逐个上传附件
      for (const att of newAttachments) {
        try {
          // 从 dataUrl 还原 File 对象再上传
          const res = await fetch(att.dataUrl);
          const blob = await res.blob();
          const file = new File([blob], att.name, { type: att.type });
          await addAttachment(newHazard.id, file);
        } catch {
          // 单个附件失败不阻断整体
        }
      }
      toast.success('隐患已添加');
      // 新增后自动调整日期范围，确保新增的隐患立即可见
      if (!startDate || formData.date < startDate) {
        setStartDate(formData.date);
      }
      if (!endDate || formData.date > endDate) {
        setEndDate(formData.date);
      }
      setDialogOpen(false);
      setFormData({
        date: formData.date,
        location: '',
        description: '',
        responsible: '',
        acceptTime: formData.date,
        status: 'unfixed',
      });
      setNewAttachments([]);
      refreshHazards();
    } catch (err: any) {
      toast.error(err.message || '添加失败');
    } finally {
      setAddingHazard(false);
    }
  };

  const handlePreview = (hazard: IHazard) => {
    setPreviewHazard(hazard);
    setPreviewOpen(true);
  };

  const [uploadingAtt, setUploadingAtt] = useState(false);
  const handlePreviewAddFile = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && previewHazard && e.target.files.length > 0) {
      const hazardId = previewHazard.id;
      setUploadingAtt(true);
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
        setUploadingAtt(false);
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

  const [savingEdit, setSavingEdit] = useState(false);
  const handleSaveEdit = async () => {
    if (!editHazard || !editField) return;
    if (!editValue.trim()) {
      toast.error('内容不能为空');
      return;
    }
    setSavingEdit(true);
    try {
      await updateHazard(editHazard.id, { [editField]: editValue.trim() });
      toast.success('修改已保存');
      setEditOpen(false);
      setEditHazard(null);
      setEditField(null);
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    } finally {
      setSavingEdit(false);
    }
  };

  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (deleteTarget) {
      setDeleting(true);
      try {
        await deleteHazard(deleteTarget.id);
        toast.success('隐患已删除');
        setDeleteTarget(null);
      } catch (err: any) {
        toast.error(err.message || '删除失败');
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleExportExcel = () => {
    exportToExcel(sortedHazards, excelConfig.exportNames.dailyHazards);
    toast.success('Excel 导出成功');
  };

  const handleExportCsv = () => {
    exportToCsv(sortedHazards, excelConfig.exportNames.dailyHazards);
    toast.success('CSV 导出成功');
  };

  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();

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

    // 统计各状态数量（基于实际导入的有效数据）
    const importedUnfixed = validItems.filter((i) => i.status === 'unfixed').length;
    const importedFixing = validItems.filter((i) => i.status === 'fixing').length;
    const importedFixed = validItems.filter((i) => i.status === 'fixed').length;

    // 跳转到导入数据中最新的日期，方便用户立即看到导入结果
    const latestDate = validItems.reduce((latest, item) =>
      item.date > latest ? item.date : latest, validItems[0].date);
    const earliestDate = validItems.reduce((earliest, item) =>
      item.date < earliest ? item.date : earliest, validItems[0].date);
    if (!startDate || earliestDate < startDate) setStartDate(earliestDate);
    if (!endDate || latestDate > endDate) setEndDate(latestDate);

    // 关闭导入弹窗
    setImportOpen(false);

    // 提示并询问是否跳转到隐患汇总页查看全部数据
    const baseMsg = `成功导入 ${count} 条：未整改 ${importedUnfixed} 条，正在整改 ${importedFixing} 条，已整改 ${importedFixed} 条`;
    if (importedFixed > 0) {
      toast(`${baseMsg}。已整改数据请到「隐患汇总」页查看`, {
        action: {
          label: '查看汇总',
          onClick: () => navigate('/summary'),
        },
        duration: 6000,
      });
    } else if (failCount > 0) {
      toast.warning(`${baseMsg}，${failCount} 条因数据不合法已跳过`);
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

  // 可编辑单元格（管理员可编辑，子账号只读）
  const EditableCell = ({
    hazard,
    field,
    isDate = false,
    isTextarea = false,
    truncate = false,
  }: {
    hazard: IHazard;
    field: EditableField;
    isDate?: boolean;
    isTextarea?: boolean;
    truncate?: boolean;
  }) => {
    if (!isAdmin) {
      return (
        <span
          className={
            truncate ? 'block max-w-[240px] truncate' : 'whitespace-nowrap'
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
            truncate ? 'block max-w-[240px] truncate' : 'whitespace-nowrap'
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
      {/* 顶部操作区 */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">未整改安全隐患</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看和管理未整改及正在整改的安全隐患
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-28 h-9 text-sm sm:w-36"
              placeholder="开始日期"
            />
            <span className="text-muted-foreground text-sm">至</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-28 h-9 text-sm sm:w-36"
              placeholder="结束日期"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs h-9"
            >
              显示全部
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">状态：</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'unfixed' | 'fixing')}>
              <SelectTrigger className="w-24 h-9 text-sm sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="unfixed">未整改</SelectItem>
                <SelectItem value="fixing">正在整改</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 h-9 text-sm">
                <Download className="size-4" />
                <span className="hidden sm:inline">导出表格</span>
                <span className="sm:hidden">导出</span>
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
              className="gap-2 h-9 text-sm"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-4" />
              <span className="hidden sm:inline">批量导入</span>
              <span className="sm:hidden">导入</span>
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-9 text-sm" style={{ backgroundColor: themeConfig.colors.primary }}>
                <Plus className="size-4" />
                <span className="hidden sm:inline">新增隐患</span>
                <span className="sm:hidden">新增</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>新增安全隐患</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>日期</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>位置</Label>
                  <Input
                    placeholder="例如：A栋3层走廊"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>问题描述</Label>
                  <Input
                    placeholder="请描述安全隐患"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>责任人</Label>
                  <Input
                    placeholder="请输入责任人姓名"
                    value={formData.responsible}
                    onChange={(e) =>
                      setFormData({ ...formData, responsible: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>验收时间</Label>
                  <Input
                    type="date"
                    value={formData.acceptTime}
                    onChange={(e) =>
                      setFormData({ ...formData, acceptTime: e.target.value })
                    }
                  />
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label>整改状态</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(val) =>
                        setFormData({ ...formData, status: val as HazardStatus })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unfixed">未整改</SelectItem>
                        <SelectItem value="fixing">正在整改</SelectItem>
                        <SelectItem value="fixed">已整改</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>附件上传</Label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                      isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }`}
                  >
                    <Upload className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium text-foreground">
                      点击选择文件或拖拽文件到此处
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      支持图片、PDF、Excel 等格式，单文件不超过 10MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={appConfig.acceptedFileTypes.hazardAttachment}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  {newAttachments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        已选择 {newAttachments.length} 个文件：
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {newAttachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span style={{ color: getFileColor(att.type) }}>
                                {getFileIcon(att.type)}
                              </span>
                              <span className="truncate text-sm">{att.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {formatFileSize(att.size)}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNewAttachment(att.id);
                              }}
                              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setNewAttachments([]);
                  }}
                >
                  取消
                </Button>
                <Button
                  onClick={handleAddHazard}
                  style={{ backgroundColor: themeConfig.colors.primary }}
                >
                  确认添加
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {isAdmin && (
            <Button variant="outline" className="gap-2" onClick={handleSync}>
              <RefreshCw className="size-4" />
              同步到手机云端
            </Button>
          )}
        </div>
      </div>

      {/* 统计卡片行 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 sm:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              隐患总数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {monthlyStats.total}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                条
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              累计隐患
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
              {monthlyStats.unfixed}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                条
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              需立即处理
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
              {monthlyStats.fixing}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                条
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              整改进行中
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
            <div className="text-3xl font-bold" style={{ color: themeConfig.colors.primary }}>
              {monthlyStats.fixed}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                条
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              已完成整改
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              整改完成率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: STATUS_COLOR.fixed }}>
              {monthlyStats.rate}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                %
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${monthlyStats.rate}%`,
                  backgroundColor: chartConfig.progressBarColor,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 隐患表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">隐患列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
                {sortedHazards.length === 0 ? (
                  <TableRow>
                    <TableCell
                       colSpan={isAdmin ? 9 : 8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      暂无未整改隐患记录
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedHazards.map((h: IHazard, index: number) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <EditableCell hazard={h} field="date" isDate />
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
                        <EditableCell hazard={h} field="acceptTime" isDate />
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
      </Card>

      {/* 趋势图 */}
      <div className="space-y-4 sm:space-y-6">
        {/* AI 趋势分析操作栏 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">趋势分析</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {useAiData && aiTrendData
                ? '当前数据由 AI 大模型分析生成'
                : '基于本地隐患数据统计，可使用 AI 生成智能分析'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {useAiData && aiTrendData && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-9"
                onClick={handleClearAi}
              >
                <RefreshCw className="size-4" />
                恢复本地数据
              </Button>
            )}
            <Button
              size="sm"
              className="gap-2 h-9"
              style={{ backgroundColor: themeConfig.colors.primary }}
              onClick={handleAiGenerate}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  AI 分析中...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  AI 生成趋势分析
                </>
              )}
            </Button>
          </div>
        </div>

        {/* AI 加载遮罩 */}
        {aiLoading && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">
                  AI 正在分析隐患数据并生成趋势报告...
                </p>
                <p className="text-xs text-muted-foreground">
                  大模型处理可能需要数秒，请耐心等待
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg">月度隐患趋势图</CardTitle>
              {useAiData && aiTrendData && (
                <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${themeConfig.colors.primary}20`, color: themeConfig.colors.primary }}>
                  <Sparkles className="size-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground hidden sm:inline">选择月份</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 w-36 text-sm sm:w-40"
              />
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ReactECharts option={monthlyTrendOption} className="h-[240px] w-full sm:h-[300px]" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg">年度隐患数量趋势图</CardTitle>
              {useAiData && aiTrendData && (
                <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${themeConfig.colors.primary}20`, color: themeConfig.colors.primary }}>
                  <Sparkles className="size-3 mr-1" />
                  AI
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground hidden sm:inline">选择年份</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-9 w-28 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {appConfig.yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>{year}年</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ReactECharts option={yearlyTrendOption} className="h-[240px] w-full sm:h-[300px]" />
          </CardContent>
        </Card>

        {/* AI 分析报告 */}
        {useAiData && aiTrendData?.analysis && (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <CardTitle className="text-base sm:text-lg">AI 趋势分析报告</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {aiTrendData.analysis}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

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
                      {att.type.startsWith('image/') && att.dataUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => {
                            window.open(att.dataUrl, '_blank');
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => handlePreviewRemoveAttachment(att.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
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
              <Input
                type="date"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
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
