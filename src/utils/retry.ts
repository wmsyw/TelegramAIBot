import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_BACKOFF_MS,
  DEFAULT_TIMEOUT_MS,
  MESSAGE_API_TIMEOUT_MS,
} from '../config/constants.js';

export const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

export function shouldRetry(err: any): boolean {
  const s = err?.response?.status;
  const code = err?.code;
  return (
    s === 429 ||
    s === 500 ||
    s === 502 ||
    s === 503 ||
    s === 504 ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    !!(err?.isAxiosError && !err?.response)
  );
}

export async function axiosWithRetry<T = any>(
  config: AxiosRequestConfig,
  tries = DEFAULT_RETRY_ATTEMPTS,
  backoffMs = DEFAULT_BACKOFF_MS
): Promise<AxiosResponse<T>> {
  let attempt = 0;
  let lastErr: any;
  const defaultTimeout = config.url?.includes('/messages') ? MESSAGE_API_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const baseConfig: AxiosRequestConfig = { timeout: defaultTimeout, ...config };

  while (attempt <= tries) {
    try {
      return await axios(baseConfig);
    } catch (err: any) {
      lastErr = err;
      if (attempt >= tries || !shouldRetry(err)) throw err;
      const jitter = Math.floor(Math.random() * 200);
      await sleep(backoffMs * Math.pow(2, attempt) + jitter);
      attempt++;
    }
  }
  throw lastErr;
}
