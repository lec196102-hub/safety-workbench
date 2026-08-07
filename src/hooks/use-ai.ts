// AI 趋势分析 Hook
// 调用后端 API（/api/ai/generate-trends）生成趋势分析
// 后端从数据库读取隐患数据并调用大模型，返回 TrendChartData 覆盖前端图表数据

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { type IHazard } from '@/data/hazards';

/** AI 生成的趋势图表数据（与后端返回结构一致） */
export interface TrendChartData {
  monthlyTrend: {
    days: string[];
    counts: number[];
  };
  yearlyTrend: {
    months: string[];
    counts: number[];
  };
  monthlyStats: {
    total: number;
    unfixed: number;
    fixing: number;
    fixed: number;
    rate: number;
  };
  analysis: string;
}

export function useAi() {
  const [aiTrendData, setAiTrendData] = useState<TrendChartData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  /**
   * 调用后端 API 生成趋势分析
   * @param hazards 当前浏览器中的全量隐患数据（localStorage）—— 仅为保持向后兼容签名，后端忽略此参数，从数据库读取数据
   * @param month   月份，格式 "2026-08"
   * @param year    年份，格式 "2026"
   */
  const generateTrends = useCallback(async (_hazards: IHazard[], month: string, year: string) => {
    setAiLoading(true);
    try {
      const data = await api.post<TrendChartData>('/ai/generate-trends', { month, year });
      setAiTrendData(data);
      return data;
    } catch (err: any) {
      console.error('AI 趋势生成失败:', String(err?.message ?? err));
      throw err;
    } finally {
      setAiLoading(false);
    }
  }, []);

  /** 清除 AI 数据，恢复本地计算 */
  const clearAiTrend = useCallback(() => {
    setAiTrendData(null);
  }, []);

  return {
    aiTrendData,
    aiLoading,
    generateTrends,
    clearAiTrend,
  };
}
