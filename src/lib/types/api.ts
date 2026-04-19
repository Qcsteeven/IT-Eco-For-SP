/**
 * Унифицированный тип для ответов API
 */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Тип для ошибок API
 */
export interface ApiError {
  message: string;
  detail?: string;
}

/**
 * Helper для создания успешного ответа
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

/**
 * Helper для создания ответа с ошибкой
 */
export function errorResponse(message: string, detail?: string): ApiResponse<never> {
  return { ok: false, error: message, ...(detail && { detail }) };
}
