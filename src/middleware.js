// middleware.js

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Логика выполнится только для маршрутов, указанных в matcher
    return NextResponse.next();
  },
  {
    // Если authorized возвращает false, пользователь будет перенаправлен на /auth/signin
    callbacks: {
      authorized: ({ token }) => {
        return !!token;
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  },
);

// ✅ ИСПРАВЛЕННЫЙ БЛОК CONFIG
export const config = {
  // Теперь Middleware будет проверять, авторизован ли пользователь,
  // когда он пытается получить доступ к корневому пути (/)
  matcher: ['/'],
};
