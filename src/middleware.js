import { withAuth } from 'next-auth/middleware';

// Маршруты, требующие определённых ролей
const ROLE_ROUTES = {
  // Маршруты администратора
  '/admin': 'admin',
  // Маршруты тренера
  '/coach': 'coach',
};

export default withAuth({
  callbacks: {
    authorized: async ({ token, req }) => {
      const { pathname } = req.nextUrl;

      if (!token) return false;

      // Заблокированные/неверифицированные считаются гостями
      if (token?.is_blocked === true) return false;
      if (token?.is_verified === false) return false;

      let effectiveRole = token.role;

      // Проверяем актуальный статус и роль в БД, чтобы блокировки и смена роли
      // применялись сразу, а не после истечения JWT.
      try {
        const url = new URL('/api/internal/auth/status', req.url);
        const res = await fetch(url, {
          headers: {
            cookie: req.headers.get('cookie') || '',
          },
        });
        if (!res.ok) return false;

        const json = await res.json();
        if (json?.active !== true) return false;
        if (typeof json?.role === 'string') {
          effectiveRole = json.role;
        }
      } catch {
        return false;
      }

      if (!effectiveRole) {
        return false;
      }

      const roleHierarchy = { guest: 0, user: 1, coach: 2, admin: 3 };
      if (roleHierarchy[effectiveRole] == null) {
        return false;
      }

      if (
        pathname.startsWith('/chat') ||
        pathname.startsWith('/profile') ||
        pathname.startsWith('/dashboard')
      ) {
        const userLevel = roleHierarchy[effectiveRole];
        if (userLevel < roleHierarchy.user) {
          return false;
        }
      }

      // Проверяем, требует ли маршрут определённой роли
      for (const [routePrefix, requiredRole] of Object.entries(ROLE_ROUTES)) {
        if (pathname.startsWith(routePrefix)) {
          const requiredLevel = roleHierarchy[requiredRole] ?? 0;
          const userLevel = roleHierarchy[effectiveRole] ?? 0;

          return userLevel >= requiredLevel;
        }
      }

      // Для остальных маршрутов — просто наличие токена
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
});

export const config = {
  matcher: [
    '/profile/:path*',
    '/chat/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
    '/coach/:path*',
  ],
};
