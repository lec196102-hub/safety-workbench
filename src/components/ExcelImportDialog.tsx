import { useState, useRef, useMemo, type DragEvent, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  Upload,
  Download,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { IHazard, HazardStatus } from '@/data/hazards';
import { STATUS_LABEL, STATUS_COLOR } from '@/data/hazards';
import excelConfig from '@/data/excel-config.json';
import hazardConfig from '@/data/hazard-config.json';
import themeConfig from '@/data/theme.json';
import { excelTemplateData } from '@/data/test_data';

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (hazards: Omit<IHazard, 'id' | 'attachments'>[], stats: { unfixed: number; fixing: number; fixed: number; total: number }) => void;
}

// 系统字段定义（从 JSON 加载）
const SYSTEM_FIELDS = excelConfig.systemFields;

// 常见列名映射（从 JSON 加载）
const COLUMN_ALIASES: Record<string, string> = excelConfig.columnAliases;

function parseStatus(value: unknown): HazardStatus {
  if (typeof value === 'boolean') return value ? 'fixed' : 'unfixed';
  if (typeof value === 'number') {
    if (value === 1) return 'fixed';
    if (value === 2) return 'fixing';
    return 'unfixed';
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    // 从 JSON 配置加载关键词
    if (hazardConfig.statusKeywords.fixed.some((kw: string) => v === kw.toLowerCase())) {
      return 'fixed';
    }
    if (hazardConfig.statusKeywords.fixing.some((kw: string) => v === kw.toLowerCase())) {
      return 'fixing';
    }
  }
  return 'unfixed';
}

function parseDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'number') {
    // Excel 日期序列号转换
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const str = String(value).trim();
  // 完整日期：YYYY-MM-DD / YYYY/MM/DD / YYYY年MM月DD日
  const fullMatch = str.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (fullMatch) {
    return `${fullMatch[1]}-${fullMatch[2].padStart(2, '0')}-${fullMatch[3].padStart(2, '0')}`;
  }
  // 短日期：M.D / M-D / 月.日（无年份，默认当年）
  const shortMatch = str.match(/^(\d{1,2})[-/.月](\d{1,2})[日号]?$/);
  if (shortMatch) {
    const year = new Date().getFullYear();
    return `${year}-${shortMatch[1].padStart(2, '0')}-${shortMatch[2].padStart(2, '0')}`;
  }
  return str;
}

export default function ExcelImportDialog({
  open,
  onOpenChange,
  onImport,
}: ExcelImportDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 重置状态
  const resetState = () => {
    setIsDragging(false);
    setIsParsing(false);
    setIsImporting(false);
    setFileName('');
    setRawData([]);
    setHeaders([]);
    setColumnMapping({});
    setImportResult(null);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  // 解析 Excel 文件
  const parseFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('请上传 Excel 文件（.xlsx 或 .xls 格式）');
      return;
    }

    setIsParsing(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          defval: '',
          raw: false,
        }) as Record<string, unknown>[];

        if (jsonData.length === 0) {
          toast.error('Excel 文件为空，请检查文件内容');
          setIsParsing(false);
          return;
        }

        // 提取表头
        const cols = Object.keys(jsonData[0]);
        setHeaders(cols);
        setRawData(jsonData);

        // 自动匹配列
        const mapping: Record<string, string> = {};
        cols.forEach((col) => {
          const fieldKey = COLUMN_ALIASES[col.trim()];
          if (fieldKey && fieldKey !== 'index') {
            mapping[col] = fieldKey;
          }
        });
        setColumnMapping(mapping);

        setIsParsing(false);
      } catch (error) {
        toast.error('文件解析失败，请检查文件格式');
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      toast.error('文件读取失败');
      setIsParsing(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseFile(file);
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

  // 下载模板
  const downloadTemplate = () => {
    const templateData = excelTemplateData;
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = excelConfig.templateColumnWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '隐患导入模板');
    XLSX.writeFile(wb, '安全隐患导入模板.xlsx');
    toast.success('模板已下载');
  };

  // 更新列映射
  const updateMapping = (column: string, fieldKey: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (fieldKey === '__none__') {
        delete next[column];
      } else {
        // 移除其他列对同一字段的映射
        Object.keys(next).forEach((k) => {
          if (next[k] === fieldKey) {
            delete next[k];
          }
        });
        next[column] = fieldKey;
      }
      return next;
    });
  };

  // 预览数据（应用列映射）
  const previewData = useMemo(() => {
    if (rawData.length === 0) return [];
    return rawData.slice(0, 5).map((row) => {
      const mapped: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([col, field]) => {
        mapped[field] = String(row[col] ?? '');
      });
      return mapped;
    });
  }, [rawData, columnMapping]);

  // 校验必填字段
  const validation = useMemo(() => {
    const requiredFields = SYSTEM_FIELDS.filter((f) => f.required);
    const mappedFields = Object.values(columnMapping);
    const missing = requiredFields.filter((f) => !mappedFields.includes(f.key));
    return {
      isValid: missing.length === 0 && rawData.length > 0,
      missingFields: missing,
    };
  }, [columnMapping, rawData]);

  // 执行导入
  const handleImport = () => {
    if (!validation.isValid) {
      toast.error('请完成所有必填字段的列匹配');
      return;
    }

    setIsImporting(true);

    setTimeout(() => {
      const hazards: Omit<IHazard, 'id' | 'attachments'>[] = [];
      let failed = 0;

      rawData.forEach((row) => {
        const mapped: Record<string, unknown> = {};
        Object.entries(columnMapping).forEach(([col, field]) => {
          mapped[field] = row[col];
        });

        const date = parseDate(mapped.date);
        const location = String(mapped.location ?? '').trim();
        const description = String(mapped.description ?? '').trim();
        const responsible = String(mapped.responsible ?? '').trim();

        // 校验必填
        if (!date || !location || !description || !responsible) {
          failed++;
          return;
        }

        hazards.push({
          date,
          location,
          description,
          responsible,
          acceptTime: parseDate(mapped.acceptTime) || date,
          status: parseStatus(mapped.status),
        });
      });

      if (hazards.length > 0) {
        const unfixed = hazards.filter((h) => h.status === 'unfixed').length;
        const fixing = hazards.filter((h) => h.status === 'fixing').length;
        const fixed = hazards.filter((h) => h.status === 'fixed').length;
        onImport(hazards, { unfixed, fixing, fixed, total: hazards.length });
      }

      setImportResult({ success: hazards.length, failed });
      setIsImporting(false);

      if (hazards.length > 0) {
        const unfixed = hazards.filter((h) => h.status === 'unfixed').length;
        const fixing = hazards.filter((h) => h.status === 'fixing').length;
        const fixed = hazards.filter((h) => h.status === 'fixed').length;
        toast.success(
          `成功导入 ${hazards.length} 条：未整改 ${unfixed} 条，正在整改 ${fixing} 条，已整改 ${fixed} 条`,
          { duration: 4000 },
        );
      } else {
        toast.error('未成功导入任何数据，请检查文件内容');
      }
    }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" style={{ color: themeConfig.colors.primary }} />
            批量导入隐患
          </DialogTitle>
          <DialogDescription className="text-xs">
            支持 Excel 文件批量导入隐患数据，导入后数据自动保存
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 未上传状态：上传区域 */}
          {rawData.length === 0 && (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                {isParsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-10 animate-spin text-primary" />
                    <p className="text-sm font-medium">正在解析文件...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto size-10 text-muted-foreground" />
                    <p className="mt-3 text-base font-medium text-foreground">
                      点击选择文件或拖拽文件到此处
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      支持 .xlsx、.xls 格式，建议先下载模板
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div className="flex items-center justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={downloadTemplate}
                >
                  <Download className="size-4" />
                  下载导入模板
                </Button>
              </div>

              <div className="rounded-lg bg-muted/50 p-4">
                <p className="mb-2 text-sm font-medium text-foreground">
                  支持的列名（自动识别）：
                </p>
                <div className="flex flex-wrap gap-2">
                  {['日期', '位置', '问题描述', '责任人', '验收时间', '整改状态'].map(
                    (name) => (
                      <Badge key={name} variant="secondary" className="text-xs">
                        {name}
                      </Badge>
                    ),
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  整改状态支持：未整改/正在整改/已整改、是/否、true/false、1/0、in progress 等格式
                </p>
              </div>
            </>
          )}

          {/* 已上传：列匹配 + 预览 */}
          {rawData.length > 0 && !importResult && (
            <>
              {/* 文件信息 */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet
                    className="size-5 shrink-0 text-green-600"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      共 {rawData.length} 条数据
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={resetState}
                >
                  <X className="size-4" />
                </Button>
              </div>

              {/* 列匹配 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">列匹配</Label>
                  <span className="text-xs text-muted-foreground">
                    请确认 Excel 列与系统字段的对应关系
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {headers.map((col) => (
                    <div
                      key={col}
                      className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                    >
                      <span className="flex-1 truncate text-sm text-muted-foreground">
                        {col}
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                      <Select
                        value={columnMapping[col] || '__none__'}
                        onValueChange={(val) => updateMapping(col, val)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">不导入</SelectItem>
                          {SYSTEM_FIELDS.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                              {f.required && (
                                <span className="ml-1 text-destructive">*</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                {!validation.isValid && validation.missingFields.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      缺少必填字段：
                      {validation.missingFields
                        .map((f) => f.label)
                        .join('、')}
                    </div>
                  </div>
                )}
              </div>

              {/* 数据预览 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">数据预览（前5行）</Label>
                <div className="max-h-60 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {SYSTEM_FIELDS.map((f) => (
                          <TableHead
                            key={f.key}
                            className="whitespace-nowrap text-xs"
                          >
                            {f.label}
                            {f.required && (
                              <span className="ml-0.5 text-destructive">*</span>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, i) => (
                        <TableRow key={i}>
                          {SYSTEM_FIELDS.map((f) => (
                            <TableCell key={f.key} className="text-xs">
                              {f.key === 'status' && row[f.key] ? (
                                <Badge
                                  variant="secondary"
                                  style={{
                                    backgroundColor: `${STATUS_COLOR[row[f.key] as HazardStatus]}20`,
                                    color: STATUS_COLOR[row[f.key] as HazardStatus],
                                  }}
                                >
                                  {STATUS_LABEL[row[f.key] as HazardStatus] ?? row[f.key]}
                                </Badge>
                              ) : row[f.key] ? (
                                row[f.key]
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {/* 导入结果 */}
          {importResult && (
            <div className="space-y-4 rounded-lg border p-6 text-center">
              <CheckCircle2
                className="mx-auto size-12 text-success"
              />
              <div>
                <p className="text-lg font-semibold">导入完成</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  成功 {importResult.success} 条，失败 {importResult.failed} 条
                </p>
              </div>
              {importResult.failed > 0 && (
                <p className="text-xs text-destructive">
                  失败原因：必填字段缺失或数据格式不正确
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {importResult ? (
            <Button onClick={handleClose} style={{ backgroundColor: themeConfig.colors.primary }}>
              完成
            </Button>
          ) : rawData.length > 0 ? (
            <>
              <Button variant="outline" onClick={resetState}>
                重新选择
              </Button>
              <Button
                onClick={handleImport}
                disabled={!validation.isValid || isImporting}
                style={{ backgroundColor: themeConfig.colors.primary }}
                className="gap-2"
              >
                {isImporting && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {isImporting ? '导入中...' : '确认导入'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
