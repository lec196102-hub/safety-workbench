// AI 路由：隐患趋势图智能生成
// 用户点击按钮 → 后端整合隐患数据为提示词 → 调用 DeepSeek → 包装为图表数据结构 → 返回前端

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db';
import { chatForJson } from '../lib/deepseek';
import { logger } from '../lib/logger';

const router = Router();

// 所有 AI 接口都需要登录
router.use(authMiddleware);

/**
 * 前端期望的图表数据结构（与 DailyHazardsPage 中的 monthlyTrendData / yearlyTrendData 一致）
 */
interface TrendChartData {
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

/**
 * POST /api/ai/generate-trends
 * 接收 { month: "2025-01", year: "2025" }
 * 返回 TrendChartData
 */
router.post('/generate-trends', async (req, res) => {
  try {
    const { month, year } = req.body;

    // 1. 从数据库获取全量隐患数据
    const hazards = db.prepare(`
      SELECT id, date, location, description, responsible, accept_time, status
      FROM hazards
      ORDER BY date DESC
    `).all() as any[];

    if (hazards.length === 0) {
      return res.json({
        monthlyTrend: { days: [], counts: [] },
        yearlyTrend: {
          months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
          counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
        monthlyStats: { total: 0, unfixed: 0, fixing: 0, fixed: 0, rate: 0 },
        analysis: '当前没有隐患数据，无法生成趋势分析。',
      } as TrendChartData);
    }

    // 2. 整合隐患数据为提示词
    const hazardSummary = hazards.map((h) => ({
      日期: h.date,
      位置: h.location,
      问题描述: h.description,
      责任人: h.responsible,
      状态: h.status === 'fixed' ? '已整改' : h.status === 'fixing' ? '正在整改' : '未整改',
    }));

    const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const targetYear = year || String(new Date().getFullYear());

    const systemPrompt = `你是一个专业的企业安全管理分析师。请根据用户提供的隐患数据，分析并生成隐患趋势报告。

你需要返回以下 JSON 格式的数据：

{
  "monthlyTrend": {
    "days": ["1号", "2号", ..., "31号"],
    "counts": [每天隐患数量]
  },
  "yearlyTrend": {
    "months": ["1月", "2月", ..., "12月"],
    "counts": [每月隐患数量]
  },
  "monthlyStats": {
    "total": 总数,
    "unfixed": 未整改数,
    "fixing": 正在整改数,
    "fixed": 已整改数,
    "rate": 整改完成率(0-100整数)
  },
  "analysis": "一段200字左右的趋势分析文字，包括隐患分布特点、高发区域、整改进度评价和安全建议"
}

注意：
- monthlyTrend 是 ${targetMonth} 月每天的数据，天数要根据该月实际天数
- yearlyTrend 是 ${targetYear} 年每月的数据
- counts 数组长度必须与 days/months 数组长度一致
- 分析文字要专业、有针对性，结合实际数据给出`;

    const userPrompt = `以下是当前系统中所有安全隐患记录（共 ${hazards.length} 条）：

${JSON.stringify(hazardSummary, null, 2)}

请分析这些数据，生成 ${targetMonth} 月的每日隐患趋势、${targetYear} 年的每月隐患趋势、整改统计以及趋势分析报告。`;

    logger.info(`[AI] 开始生成趋势分析, 隐患数: ${hazards.length}, 月份: ${targetMonth}, 年份: ${targetYear}`);

    // 3. 调用 DeepSeek API
    const result = await chatForJson<TrendChartData>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 2048 },
    );

    // 4. 校验并补全返回数据
    const safeResult: TrendChartData = {
      monthlyTrend: {
        days: result.monthlyTrend?.days ?? [],
        counts: result.monthlyTrend?.counts ?? [],
      },
      yearlyTrend: {
        months: result.yearlyTrend?.months ?? [],
        counts: result.yearlyTrend?.counts ?? [],
      },
      monthlyStats: {
        total: result.monthlyStats?.total ?? hazards.length,
        unfixed: result.monthlyStats?.unfixed ?? 0,
        fixing: result.monthlyStats?.fixing ?? 0,
        fixed: result.monthlyStats?.fixed ?? 0,
        rate: result.monthlyStats?.rate ?? 0,
      },
      analysis: result.analysis ?? '分析生成失败，请重试。',
    };

    logger.info('[AI] 趋势分析生成完成');

    res.json(safeResult);
  } catch (err: any) {
    logger.error('[AI] 生成趋势分析失败:', String(err?.message ?? err));
    res.status(500).json({
      error: err?.message ?? 'AI 分析失败，请稍后重试',
    });
  }
});

export default router;
