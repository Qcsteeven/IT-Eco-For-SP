import { withAuth } from 'next-auth/middleware';

const ROLE_HIERARCHY = { guest: 0, user: 1, coach: 2, admin: 3 };

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      const { pathname } = req.nextUrl;

      if (!token) return false;
      if (token?.is_blocked === true) return false;
      if (token?.is_verified === false) return false;

      const role = token.role;
      const userLevel = ROLE_HIERARCHY[role] ?? -1;

      if (userLevel < 0) return false;

      if (pathname.startsWith('/admin')) return userLevel >= ROLE_HIERARCHY.admin;
      if (pathname.startsWith('/coach')) return userLevel >= ROLE_HIERARCHY.coach;

      // /profile, /chat, /dashboard
      return userLevel >= ROLE_HIERARCHY.user;
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
