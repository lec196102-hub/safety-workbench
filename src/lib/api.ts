// EXPORTS: api, setAuthToken, clearAuthToken, getAuthToken
// 原生 fetch 封装，使用 localStorage 持久化 JWT token
// 所有请求自动携带 Authorization: Bearer <token>

import appConfig from '@/data/app-config.json';

const TOKEN_KEY = appConfig.storageKeys.token;

// ---- Token 管理 ----

export function getAuthToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

// ---- 简易 logger ----

const log = {
  info: (...args: any[]) => console.log('[API]', ...args),
  error: (...args: any[]) => console.error('[API]', ...args),
  warn: (...args: any[]) => console.warn('[API]', ...args),
};

// ---- 请求封装 ----

interface RequestOptions {
  method?: string;
  params?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  /** 为 true 时不自动添加 Authorization 头（登录接口用） */
  noAuth?: boolean;
  /** 为 true 时 body 作为 FormData 直接传递（文件上传用） */
  formData?: boolean;
}

function buildUrl(endpoint: string, params?: Record<string, any>): string {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `/api${path}`;
  if (!params) return url;
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      search.append(k, String(v));
    }
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function api<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', params, body, headers: customHeaders, noAuth, formData } = options;

  const headers: Record<string, string> = { ...customHeaders };
  if (!noAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  if (!formData && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const url = buildUrl(endpoint, params);
  const fetchOptions: RequestInit = { method, headers };

  if (body !== undefined) {
    fetchOptions.body = formData ? (body as FormData) : JSON.stringify(body);
  }

  try {
    const response = await fetch(url, fetchOptions);

    // 401: token 过期或无效
    if (response.status === 401) {
      clearAuthToken();
      throw new Error('登录已过期，请重新登录');
    }

    // 尝试解析 JSON
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const msg = (typeof data === 'object' && data?.error) || `请求失败 (${response.status})`;
      log.error(`${endpoint}: ${msg}`);
      throw new Error(String(msg));
    }

    return data as T;
  } catch (err: any) {
    if (err.message === '登录已过期，请重新登录') {
      throw err;
    }
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      log.error('网络连接失败');
      throw new Error('网络连接失败，请检查网络或后端服务');
    }
    log.error(`${endpoint}: ${String(err?.message ?? err)}`);
    throw err;
  }
}

// 便捷方法
api.get = <T = any>(url: string, params?: Record<string, any>) =>
  api<T>(url, { method: 'GET', params });

api.post = <T = any>(url: string, body?: any, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
  api<T>(url, { ...opts, method: 'POST', body });

api.put = <T = any>(url: string, body?: any) =>
  api<T>(url, { method: 'PUT', body });

api.delete = <T = any>(url: string) =>
  api<T>(url, { method: 'DELETE' });

api.upload = <T = any>(url: string, formData: FormData) =>
  api<T>(url, { method: 'POST', body: formData, formData: true });
