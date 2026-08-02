// EXPORTS: IHazard, IAttachment, HazardStatus, HAZARD_STATUS, STATUS_LABEL, STATUS_COLOR
// 类型定义 + 状态配置常量（真数据）
// 假数据已移至 test_data.js，后端就绪后删除该文件即可

import hazardConfig from './hazard-config.json';

export interface IAttachment {
  id: string
  name: string
  size: number
  type: string
  dataUrl?: string
  url?: string
  uploadTime: string
}

export type HazardStatus = 'unfixed' | 'fixing' | 'fixed'

export const HAZARD_STATUS = hazardConfig.statusValues as Record<string, HazardStatus>

export const STATUS_LABEL: Record<HazardStatus, string> = hazardConfig.statusLabels as Record<HazardStatus, string>

export const STATUS_COLOR: Record<HazardStatus, string> = hazardConfig.statusColors as Record<HazardStatus, string>

export interface IHazard {
  id: string
  date: string
  location: string
  description: string
  responsible: string
  acceptTime: string
  status: HazardStatus
  attachments: IAttachment[]
}
