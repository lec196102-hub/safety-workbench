// DeepSeek API 客户端
// 文档：https://api-docs.deepseek.com/zh-cn/
// 使用 OpenAI 兼容格式，通过 fetch 调用，无需额外 SDK 依赖

import { appConfig } from './config';
import { logger } from './logger';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = appConfig.deepseek.baseUrl;
const DEEPSEEK_MODEL = appConfig.deepseek.model;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 调用 DeepSeek Chat Completions API
 * 支持 JSON Output 模式（response_format: { type: 'json_object' }）
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<DeepSeekResponse> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY 环境变量未设置，请在 .env 或系统环境变量中配置');
  }

  const body: Record<string, any> = {
    model: DEEPSEEK_MODEL,
    messages,
    stream: false,
    temperature: options?.temperature ?? appConfig.deepseek.temperature,
    max_tokens: options?.maxTokens ?? appConfig.deepseek.maxTokens,
  };

  if (options?.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  logger.info(`[DeepSeek] 调用模型: ${DEEPSEEK_MODEL}, 消息数: ${messages.length}`);

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[DeepSeek] API 错误 ${response.status}: ${errorText}`);
    throw new Error(`DeepSeek API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  logger.info(
    `[DeepSeek] 调用成功, tokens: ${data.usage?.total_tokens ?? 'unknown'}`,
  );

  return {
    content,
    usage: data.usage,
  };
}

/**
 * 调用 DeepSeek 并解析 JSON 输出
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
    logger.error('[DeepSeek] JSON 解析失败:', jsonStr.substring(0, 200));
    throw new Error('大模型返回的数据格式不正确，无法解析为 JSON');
  }
}
