/**
 * Cloudflare Worker - DeepSeek AI 代理
 * 为「安全生产工作台」提供隐患趋势分析能力
 *
 * 职责：
 *  1. 接收前端 POST 请求 { hazards: [...], month: "2026-08", year: "2026" }
 *  2. 基于隐患数据构建 system / user 提示词
 *  3. 调用 DeepSeek chat/completions（JSON 模式）
 *  4. 解析、清洗、校验并补全返回结构
 *  5. 统一加上 CORS 头返回
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

/* ----------------------------- CORS 头 ----------------------------- */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  ...CORS_HEADERS,
};

/* --------------------------- 空结果结构 ---------------------------- */

function emptyResult() {
  return {
    monthlyTrend: { days: [], counts: [] },
    yearlyTrend: { months: [], counts: [] },
    monthlyStats: { total: 0, unfixed: 0, fixing: 0, fixed: 0, rate: 0 },
    analysis: '',
  };
}

/* ----------------------------- 提示词 ------------------------------ */

const SYSTEM_PROMPT = `你是一个专业的企业安全管理分析师。请根据用户提供的隐患数据，分析并生成隐患趋势报告。

你需要返回以下 JSON 格式的数据：
{
  "monthlyTrend": { "days": ["1号", "2号", ..., "31号"], "counts": [每天隐患数量] },
  "yearlyTrend": { "months": ["1月", "2月", ..., "12月"], "counts": [每月隐患数量] },
  "monthlyStats": { "total": 总数, "unfixed": 未整改数, "fixing": 正在整改数, "fixed": 已整改数, "rate": 整改完成率(0-100整数) },
  "analysis": "一段200字左右的趋势分析文字"
}

注意：
- monthlyTrend 是指定月每天的数据，天数要根据该月实际天数
- yearlyTrend 是指定年每月的数据
- counts 数组长度必须与 days/months 数组长度一致`;

function buildUserPrompt(hazards, month, year) {
  return [
    '请根据以下隐患数据进行分析：',
    '',
    `月份：${month}`,
    `年份：${year}`,
    '',
    '隐患数据（JSON）：',
    JSON.stringify(hazards, null, 2),
  ].join('\n');
}

/* ------------------------ 本地兜底计算工具 ------------------------- */

function parseYearMonth(monthStr) {
  // monthStr 形如 "2026-08"
  const parts = String(monthStr || '').split('-').map(Number);
  return { year: parts[0] || new Date().getFullYear(), month: parts[1] || new Date().getMonth() + 1 };
}

function daysInMonth(year, month) {
  // month 为 1-based，传入 month 得到该月最后一天
  return new Date(year, month, 0).getDate();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 当 DeepSeek 不可用或返回异常时，前端可用的兜底结构 */
function computeFallback(hazards, month, year) {
  const { year: mYear, month: mMonth } = parseYearMonth(month);
  const yearNum = Number(year) || mYear;

  // 月度趋势：指定月每天
  const dim = daysInMonth(mYear, mMonth);
  const days = [];
  const dayCounts = [];
  const monthPrefix = `${mYear}-${pad2(mMonth)}`;
  for (let d = 1; d <= dim; d++) {
    days.push(`${d}号`);
    const dateStr = `${monthPrefix}-${pad2(d)}`;
    dayCounts.push(hazards.filter((h) => h && h.date === dateStr).length);
  }

  // 年度趋势：指定年每月
  const months = [];
  const monthCounts = [];
  for (let mo = 1; mo <= 12; mo++) {
    months.push(`${mo}月`);
    const prefix = `${yearNum}-${pad2(mo)}`;
    monthCounts.push(hazards.filter((h) => h && typeof h.date === 'string' && h.date.startsWith(prefix)).length);
  }

  // 月度统计：基于指定月隐患
  const monthHazards = hazards.filter((h) => h && typeof h.date === 'string' && h.date.startsWith(monthPrefix));
  const total = monthHazards.length;
  const fixed = monthHazards.filter((h) => h.isFixed === true).length;
  const unfixed = total - fixed;
  const rate = total === 0 ? 0 : Math.round((fixed / total) * 100);

  return {
    monthlyTrend: { days, counts: dayCounts },
    yearlyTrend: { months, counts: monthCounts },
    monthlyStats: { total, unfixed, fixing: 0, fixed, rate },
    analysis: '',
  };
}

/* ----------------------- 解析 / 清洗 / 校验 ------------------------ */

/** 去除 DeepSeek 可能返回的 ```json ... ``` 包裹 */
function cleanJsonText(text) {
  let t = String(text).trim();
  // 兼容 ```json、```JSON、``` 等
  const fence = /^```(?:json)?\s*/i;
  if (fence.test(t)) {
    t = t.replace(fence, '').replace(/```\s*$/i, '');
  }
  return t.trim();
}

function toNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/** 将 counts 对齐到 labels 长度，越界裁剪、缺失补 0 */
function alignCounts(labels, counts) {
  const len = labels.length;
  const out = new Array(len).fill(0);
  if (Array.isArray(counts)) {
    for (let i = 0; i < len; i++) {
      out[i] = toNumber(counts[i], 0);
    }
  }
  return out;
}

function validateResult(parsed, hazards, month, year) {
  const fallback = computeFallback(hazards, month, year);
  const result = emptyResult();

  // monthlyTrend
  const mt = parsed && parsed.monthlyTrend;
  if (mt && Array.isArray(mt.days) && mt.days.length > 0) {
    result.monthlyTrend.days = mt.days.map(String);
    result.monthlyTrend.counts = alignCounts(result.monthlyTrend.days, mt.counts);
  } else {
    result.monthlyTrend = fallback.monthlyTrend;
  }

  // yearlyTrend
  const yt = parsed && parsed.yearlyTrend;
  if (yt && Array.isArray(yt.months) && yt.months.length > 0) {
    result.yearlyTrend.months = yt.months.map(String);
    result.yearlyTrend.counts = alignCounts(result.yearlyTrend.months, yt.counts);
  } else {
    result.yearlyTrend = fallback.yearlyTrend;
  }

  // monthlyStats
  const ms = parsed && parsed.monthlyStats;
  if (ms && typeof ms === 'object') {
    const total = toNumber(ms.total, 0);
    const fixed = toNumber(ms.fixed, 0);
    const unfixed = toNumber(ms.unfixed, 0);
    const fixing = toNumber(ms.fixing, 0);
    let rate = toNumber(ms.rate, NaN);
    if (Number.isNaN(rate)) {
      rate = total > 0 ? Math.round((fixed / total) * 100) : 0;
    }
    result.monthlyStats = {
      total,
      unfixed,
      fixing,
      fixed,
      rate: Math.max(0, Math.min(100, Math.round(rate))),
    };
  } else {
    result.monthlyStats = fallback.monthlyStats;
  }

  // analysis
  result.analysis = typeof parsed?.analysis === 'string' && parsed.analysis.trim().length > 0
    ? parsed.analysis.trim()
    : fallback.analysis;

  return result;
}

/* --------------------------- Worker 入口 --------------------------- */

export default {
  async fetch(request, env) {
    // 1. 处理 OPTIONS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 2. 仅接受 POST
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: '仅支持 POST 请求' }),
        { status: 405, headers: JSON_HEADERS },
      );
    }

    // 3. 解析请求体
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: '请求体不是有效的 JSON' }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const { hazards, month, year } = body || {};

    // 4. 没有隐患数据：直接返回空结构，不调用 API
    if (!Array.isArray(hazards) || hazards.length === 0) {
      return new Response(JSON.stringify(emptyResult()), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    // 5. 校验 API Key
    if (!env || !env.DEEPSEEK_API_KEY) {
      return new Response(
        JSON.stringify({ error: '未配置 DEEPSEEK_API_KEY 环境变量' }),
        { status: 500, headers: JSON_HEADERS },
      );
    }

    // 6. 构建提示词
    const userPrompt = buildUserPrompt(hazards, month, year);

    // 7. 调用 DeepSeek
    let apiResponse;
    try {
      apiResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          temperature: 0.3,
          max_tokens: 2048,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: `调用 DeepSeek API 失败: ${e.message}` }),
        { status: 502, headers: JSON_HEADERS },
      );
    }

    // 8. 检查 HTTP 状态
    if (!apiResponse.ok) {
      const errText = await apiResponse.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: `DeepSeek API 返回错误 ${apiResponse.status}: ${errText}` }),
        { status: 502, headers: JSON_HEADERS },
      );
    }

    // 9. 解析 DeepSeek 响应
    let apiData;
    try {
      apiData = await apiResponse.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: '解析 DeepSeek 响应失败' }),
        { status: 502, headers: JSON_HEADERS },
      );
    }

    const content = apiData?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: 'DeepSeek 未返回有效内容' }),
        { status: 502, headers: JSON_HEADERS },
      );
    }

    // 10. 清洗 + 解析 JSON
    let parsed;
    try {
      const cleaned = cleanJsonText(content);
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // JSON 解析失败：使用本地兜底计算，保证前端可用
      const fallback = computeFallback(hazards, month, year);
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    // 11. 校验并补全字段
    const result = validateResult(parsed, hazards, month, year);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: JSON_HEADERS,
    });
  },
};
