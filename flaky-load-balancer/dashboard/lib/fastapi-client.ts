/**
 * FastAPI client utilities for checking availability and proxying requests.
 */

import { FASTAPI_URL, FASTAPI_TIMEOUT } from './config';

/**
 * Check if FastAPI is available by making a HEAD request to /health.
 */
export async function isFastAPIAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FASTAPI_TIMEOUT);

    const response = await fetch(`${FASTAPI_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Proxy a request to FastAPI and return the response.
 */
export async function proxyToFastAPI(path: string): Promise<Response> {
  return fetch(`${FASTAPI_URL}${path}`);
}

/**
 * Proxy a request to FastAPI and return JSON data.
 */
export async function proxyToFastAPIJson<T>(path: string): Promise<T | null> {
  try {
    const response = await proxyToFastAPI(path);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}
