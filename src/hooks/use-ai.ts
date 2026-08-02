// AI 趋势分析 Hook
// 直接调用 Cloudflare Worker（AI 代理），由 Worker 整合隐患数据 + 调用 DeepSeek 大模型
// 返回与本地计算结构一致的 TrendChartData，前端据此覆盖图表数据
// 方案 C：前端部署到 GitHub Pages，AI 通过 Cloudflare Workers 免费中转，API Key 藏在 Worker 里

import { useState, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { type IHazard } from '@/data/hazards';
import appConfig from '@/data/app-config.json';

/** AI 生成的趋势图表数据（与 Worker 返回结构一致） */
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
   * 调用 Cloudflare Worker AI 代理生成趋势分析
   * @param hazards 当前浏览器中的全量隐患数据（localStorage）
   * @param month   月份，格式 "2026-08"
   * @param year    年份，格式 "2026"
   */
  const generateTrends = useCallback(async (hazards: IHazard[], month: string, year: string) => {
    const workerUrl = appConfig.deepseek.workerUrl;
    if (!workerUrl) {
      throw new Error('AI 服务地址未配置，请在 app-config.json 中设置 deepseek.workerUrl');
    }

    setAiLoading(true);
    try {
      // 将 IHazard（status 字段）映射为 Worker 期望的格式（isFixed 字段）
      const payload = {
        hazards: hazards.map((h) => ({
          id: h.id,
          date: h.date,
          location: h.location,
          description: h.description,
          responsible: h.responsible,
          acceptTime: h.acceptTime,
          isFixed: h.status === 'fixed',
        })),
        month,
        year,
      };

      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`AI 服务返回错误 ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as TrendChartData;
      setAiTrendData(data);
      return data;
    } catch (err: any) {
      logger.error('AI 趋势生成失败:', String(err?.message ?? err));
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
