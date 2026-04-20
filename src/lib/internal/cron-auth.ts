import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

/**
 * Проверка Bearer-токена для фоновых вызовов (Render Cron, dev-cron).
 * - В production без CRON_SECRET — вызовы запрещены (503).
 * - Если CRON_SECRET задан — нужен заголовок Authorization: Bearer <тот же секрет>.
 * - Если секрет не задан и это не production — разрешено (удобство локальной разработки).
 */
export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const auth = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!auth.startsWith(prefix)) return false;
  const token = auth.slice(prefix.length);
  if (token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(secret, 'utf8'));
}

/** null — можно продолжать; иначе готовый ответ с ошибкой. */
export function cronAuthErrorResponse(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !secret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET должен быть задан в production' },
      { status: 503 },
    );
  }

  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
