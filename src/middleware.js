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
    authorized: ({ token, req }) => {
      const { pathname } = req.nextUrl;

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
