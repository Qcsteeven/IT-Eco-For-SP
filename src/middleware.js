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

      // Заблокированные/неверифицированные считаются гостями
      if (token?.is_blocked === true) return false;
      if (token?.is_verified === false) return false;

      // Если токен старый и флаги не проставлены — проверяем статус через сервер (БД)
      if (token && (token.is_blocked == null || token.is_verified == null)) {
        try {
          const url = new URL('/api/internal/auth/status', req.url);
          const res = await fetch(url, {
            headers: {
              cookie: req.headers.get('cookie') || '',
            },
          });
          if (res.ok) {
            const json = await res.json();
            if (json?.active === false) return false;
          } else {
            // если не можем проверить — считаем гостем (fail closed)
            return false;
          }
        } catch {
          return false;
        }
      }

      // Проверяем, требует ли маршрут определённой роли
      for (const [routePrefix, requiredRole] of Object.entries(ROLE_ROUTES)) {
        if (pathname.startsWith(routePrefix)) {
          // Проверяем роль пользователя
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
