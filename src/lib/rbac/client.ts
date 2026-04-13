// ==========================================
// useRoleGuard — хук для защиты компонентов
// ==========================================

'use client';

import { useSession } from 'next-auth/react';
import { UserRole, hasRoleLevel, ROLE_REDIRECT_PATHS } from '@/lib/rbac';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Хук для защиты клиентских компонентов по роли.
 * Возвращает объект { authorized, isLoading, session }.
 *
 * Если authorized === false и isLoading === false — можно показать заглушку.
 */
export function useRoleGuard(requiredRole: UserRole) {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  if (isLoading) {
    return { authorized: false, isLoading: true, session: null, role: null as null };
  }

  if (!session?.user?.role) {
    return { authorized: false, isLoading: false, session: null, role: null as null };
  }

  const userRole = session.user.role as UserRole;
  const authorized = hasRoleLevel(userRole, requiredRole);

  return { authorized, isLoading: false, session, role: userRole };
}

/**
 * Хук для редиректа, если роль недостаточна.
 * Автоматически редиректит на соответствующий роль маршрут.
 */
export function useRoleRedirect(requiredRole: UserRole) {
  const router = useRouter();
  const { authorized, isLoading } = useRoleGuard(requiredRole);

  useEffect(() => {
    if (!isLoading && !authorized) {
      // Редирект на маршрут, соответствующий роли пользователя
      const session = useSession();
      if (session.data?.user?.role && hasRoleLevel(session.data.user.role as UserRole, 'user')) {
        // Если пользователь авторизован, но нет доступа — на dashboard
        router.push(ROLE_REDIRECT_PATHS['user']);
      } else {
        router.push(ROLE_REDIRECT_PATHS['guest']);
      }
    }
  }, [authorized, isLoading, router]);

  return { authorized, isLoading };
}
