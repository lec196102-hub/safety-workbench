// AI 大模型客户端（支持火山引擎 ARK API / DeepSeek API）
// 火山引擎 ARK 文档：https://www.volcengine.com/docs/82379/1298459
// 使用 OpenAI 兼容格式，通过 fetch 调用，无需额外 SDK 依赖

import { appConfig } from './config';
import { logger } from './logger';

// 优先使用 ARK_API_KEY（火山引擎），兼容旧的 DEEPSEEK_API_KEY
const AI_API_KEY = process.env.ARK_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const AI_BASE_URL = appConfig.deepseek.baseUrl;
const AI_MODEL = appConfig.deepseek.model;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 调用 AI Chat Completions API
 * 支持 JSON Output 模式（response_format: { type: 'json_object' }）
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<ChatResponse> {
  if (!AI_API_KEY) {
    throw new Error('ARK_API_KEY（或 DEEPSEEK_API_KEY）环境变量未设置，请在 .env 或系统环境变量中配置');
  }

  const body: Record<string, any> = {
    model: AI_MODEL,
    messages,
    stream: false,
    temperature: options?.temperature ?? appConfig.deepseek.temperature,
    max_tokens: options?.maxTokens ?? appConfig.deepseek.maxTokens,
  };

  if (options?.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  logger.info(`[AI] 调用模型: ${AI_MODEL}, 消息数: ${messages.length}`);

  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[AI] API 错误 ${response.status}: ${errorText}`);
    throw new Error(`AI API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  logger.info(
    `[AI] 调用成功, tokens: ${data.usage?.total_tokens ?? 'unknown'}`,
  );

  return {
    content,
    usage: data.usage,
  };
}

/**
 * 调用 AI 大模型并解析 JSON 输出
 * 自动在 system prompt 中追加 JSON 格式要求
 */
export async function chatForJson<T = any>(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<T> {
  // 确保系统消息中包含 JSON 格式要求
  const systemMsg = messages.find((m) => m.role === 'system');
  if (systemMsg && !systemMsg.content.includes('JSON')) {
    systemMsg.content += '\n\n请务必以纯 JSON 格式返回结果，不要包含 markdown 代码块标记或其他多余文本。';
  }

  const result = await chatCompletion(messages, {
    jsonMode: true,
    ...options,
  });

  // 清理可能的 markdown 代码块标记
  let jsonStr = result.content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    logger.error('[AI] JSON 解析失败:', jsonStr.substring(0, 200));
    throw new Error('大模型返回的数据格式不正确，无法解析为 JSON');
  }
}
