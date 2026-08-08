// EXPORTS: ISpecialWork, ISpecialWorkAttachment, SpecialWorkStatus, SPECIAL_WORK_CATEGORIES
// 特种作业审批：类型定义 + 状态/类别常量

export interface ISpecialWorkAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  filePath?: string;
  url?: string;
  dataUrl?: string;
  uploadTime: string;
}

export type SpecialWorkCategory = 'hot_work' | 'confined_space' | 'high_altitude';

export const SPECIAL_WORK_CATEGORY_LABELS: Record<SpecialWorkCategory, string> = {
  hot_work: '动火作业',
  confined_space: '有限空间作业',
  high_altitude: '高空作业',
};

export const SPECIAL_WORK_CATEGORY_OPTIONS: { value: SpecialWorkCategory; label: string }[] = [
  { value: 'hot_work', label: '动火作业' },
  { value: 'confined_space', label: '有限空间作业' },
  { value: 'high_altitude', label: '高空作业' },
];

export type SpecialWorkStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export const SPECIAL_WORK_STATUS_LABEL: Record<SpecialWorkStatus, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已驳回',
  completed: '已完成',
  cancelled: '已取消',
};

export const SPECIAL_WORK_STATUS_COLOR: Record<SpecialWorkStatus, string> = {
  pending: '#f59e0b',
  approved: '#3b82f6',
  rejected: '#ef4444',
  completed: '#22c55e',
  cancelled: '#9ca3af',
};

export const SPECIAL_WORK_STATUS_FLOW: SpecialWorkStatus[] = [
  'pending', 'approved', 'completed', 'cancelled',
];

export interface ISpecialWork {
  id: string;
  category: SpecialWorkCategory;
  workTime: string;
  location: string;
  applicant: string;
  approver: string;
  guardian: string;
  endTime: string;
  status: SpecialWorkStatus;
  attachments: ISpecialWorkAttachment[];
  createdAt: string;
  updatedAt: string;
}
