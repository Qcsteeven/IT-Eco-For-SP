import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Маршруты, требующие определённых ролей
const ROLE_ROUTES = {
  // Маршруты администратора
  '/admin': 'admin',
  // Маршруты тренера
  '/coach': 'coach',
  // Страница управления мероприятиями (исторически была отдельно от /coach/events)
  '/events': 'coach',
  // Admin API
  '/api/admin': 'admin',
};

// Простейший rate limit (best-effort, для защиты от злоупотреблений).
// В Edge окружении состояние не гарантировано между инстансами, но в dev/одиночном инстансе работает.
const RATE_LIMIT_STATE = new Map(); // key -> { resetAt:number, count:number }

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const existing = RATE_LIMIT_STATE.get(key);
  if (!existing || existing.resetAt <= now) {
    RATE_LIMIT_STATE.set(key, { resetAt: now + windowMs, count: 1 });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }
  existing.count += 1;
  return { ok: true };
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth?.token;

    // Rate limit для admin API и sync-results
    if (pathname.startsWith('/api/admin') || pathname.endsWith('/sync-results')) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const subject = token?.sub || 'anon';
      const bucket = pathname.startsWith('/api/admin')
        ? { limit: 60, windowMs: 60_000 }
        : { limit: 10, windowMs: 60_000 };

      const rl = rateLimit(
        `${bucket.limit}:${pathname.startsWith('/api/admin') ? 'admin' : 'sync'}:${ip}:${subject}`,
        bucket.limit,
        bucket.windowMs,
      );
      if (!rl.ok) {
        const res = NextResponse.json(
          { ok: false, error: 'Слишком много запросов. Попробуйте позже.' },
          { status: 429 },
        );
        const retryAfterSec = Math.max(1, Math.ceil((rl.retryAfterMs || 1000) / 1000));
        res.headers.set('retry-after', String(retryAfterSec));
        return res;
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Проверяем, требует ли маршрут определённой роли
        for (const [routePrefix, requiredRole] of Object.entries(ROLE_ROUTES)) {
          if (pathname.startsWith(routePrefix)) {
            const userRole = token?.role;
            if (!userRole) return false;

            const roleHierarchy = { guest: 0, user: 1, coach: 2, admin: 3 };
            const requiredLevel = roleHierarchy[requiredRole] ?? 0;
            const userLevel = roleHierarchy[userRole] ?? 0;

            return userLevel >= requiredLevel;
          }
        }

        // Для остальных маршрутов — просто наличие токена
        return !!token;
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  },
);

export const config = {
  matcher: [
    '/profile/:path*',
    '/chat/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
    '/coach/:path*',
    '/events/:path*',
    '/api/admin/:path*',
    '/api/events/:path*/sync-results',
  ],
};
