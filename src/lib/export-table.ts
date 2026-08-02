import * as XLSX from 'xlsx';
import { STATUS_LABEL, type IHazard } from '@/data/hazards';
import excelConfig from '@/data/excel-config.json';

export interface ExportHazardRow {
  序号: number;
  日期: string;
  位置: string;
  问题描述: string;
  责任人: string;
  验收时间: string;
  整改状态: string;
  附件数量: number;
}

function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function transformData(hazards: IHazard[]): ExportHazardRow[] {
  return hazards.map((h, i) => ({
    序号: i + 1,
    日期: h.date,
    位置: h.location,
    问题描述: h.description,
    责任人: h.responsible,
    验收时间: h.acceptTime,
    整改状态: STATUS_LABEL[h.status] ?? '未整改',
    附件数量: h.attachments?.length ?? 0,
  }));
}

export function exportToExcel(hazards: IHazard[], filename = '安全隐患汇总') {
  const rows = transformData(hazards);
  const ws = XLSX.utils.json_to_sheet(rows);
  // 设置列宽（从 JSON 配置加载）
  ws['!cols'] = excelConfig.exportColumnWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '隐患清单');
  XLSX.writeFile(wb, `${filename}_${formatDate()}.xlsx`);
}

export function exportToCsv(hazards: IHazard[], filename = '安全隐患汇总') {
  const rows = transformData(hazards);
  if (rows.length === 0) {
    return;
  }
  const headers = Object.keys(rows[0]) as (keyof ExportHazardRow)[];
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = String(row[h]);
          // 含逗号或引号的字段用双引号包裹
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(','),
    ),
  ].join('\n');

  // 加 BOM 防止中文乱码
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${formatDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
