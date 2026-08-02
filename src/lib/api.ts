// EXPORTS: api, setAuthToken, clearAuthToken

import { axiosForBackend, logger } from '@lark-apaas/client-toolkit-lite';

let authToken = '';

export function setAuthToken(token: string) {
  authToken = token;
}

export function clearAuthToken() {
  authToken = '';
}

interface RequestOptions {
  method?: string;
  params?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
}

function buildUrl(endpoint: string): string {
  if (endpoint.startsWith('http')) return endpoint;
  // 后端所有路由统一挂在 /api 前缀下（server/index.ts: app.use('/api/...')
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `/api${path}`;
}

export async function api<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', params, body, headers: customHeaders } = options;

  const headers: Record<string, string> = { ...customHeaders };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await axiosForBackend.request({
      url: buildUrl(endpoint),
      method,
      params,
      data: body,
      headers,
      // 后端用自定义 JWT，不需要平台自动附加的凭证头冲突时以我们的为准
      withCredentials: false,
    });
    return response.data as T;
  } catch (err: any) {
    if (err.response) {
      const data = err.response.data;
      const msg =
        (typeof data === 'string' ? data : data?.error) || `请求失败 (${err.response.status})`;
      logger.error(`API Error ${endpoint}: ${String(msg)}`);
      throw new Error(String(msg));
    }
    if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
      const msg = '网络连接失败，请检查后端服务是否启动';
      logger.error(msg);
      throw new Error(msg);
    }
    logger.error(`API Error ${endpoint}: ${String(err?.message ?? err)}`);
    throw err;
  }
}

// 便捷方法
api.get = <T = any>(url: string, params?: Record<string, any>) =>
  api<T>(url, { method: 'GET', params });

api.post = <T = any>(url: string, body?: any) =>
  api<T>(url, { method: 'POST', body });

api.put = <T = any>(url: string, body?: any) =>
  api<T>(url, { method: 'PUT', body });

api.delete = <T = any>(url: string) =>
  api<T>(url, { method: 'DELETE' });

api.upload = <T = any>(url: string, formData: FormData) =>
  api<T>(url, { method: 'POST', body: formData });
