import { ApiError } from '../../types';

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  backoffMs?: number;
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 30000,
    retries = 3,
    backoffMs = 1000,
    ...fetchOptions
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Don't retry on client errors (4xx) except 429
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on server errors (5xx) or rate limit (429)
      if (response.status >= 500 || response.status === 429) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on abort or network errors that are likely permanent
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('NetworkError'))) {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError!;
}

export function createApiError(
  code: string,
  message: string,
  provider?: string,
  status?: number,
  raw?: any
): ApiError {
  return {
    code,
    message,
    provider: provider as any,
    status,
    raw,
  };
}

export function handleApiResponse(response: Response, provider?: string): Response {
  if (!response.ok) {
    let code = 'PROVIDER_ERROR';
    if (response.status === 401 || response.status === 403) {
      code = 'AUTH_ERROR';
    } else if (response.status === 404) {
      code = 'ENDPOINT_NOT_FOUND';
    } else if (response.status === 429) {
      code = 'RATE_LIMIT';
    } else if (response.status >= 500) {
      code = 'NETWORK_ERROR';
    }

    throw createApiError(code, `HTTP ${response.status}: ${response.statusText}`, provider, response.status);
  }

  return response;
}
