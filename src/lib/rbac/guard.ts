// ==========================================
// Role Guard — защита API роутов по ролям
// ==========================================

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { UserRole, hasRoleLevel, isValidUserRole } from '@/lib/rbac';

type SessionWithUserAndRole = Session & {
  user: NonNullable<Session['user']> & { role?: string };
};

export interface RoleGuardOptions {
  /** Минимальная требуемая роль */
  requiredRole: UserRole;
  /** Сообщение об ошибке при недостатке прав */
  forbiddenMessage?: string;
}

/**
 * Higher-order function для защиты API роутов по роли.
 * Оборачивает handler и проверяет сессию перед выполнением.
 *
 * @example
 * export const GET = withRoleGuard(async (req, session) => {
 *   // ваш код
 * }, { requiredRole: 'admin' });
 */
export function withRoleGuard(
  handler: (
    req: NextRequest,
    session: SessionWithUserAndRole
  ) => Promise<NextResponse>,
  options: RoleGuardOptions
) {
  return async function protectedHandler(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    const pathname = req.nextUrl?.pathname || new URL(req.url).pathname;
    const method = req.method || 'GET';

    if (!session?.user) {
      console.warn('[RBAC] 401 unauthorized', {
        pathname,
        method,
        requiredRole: options.requiredRole,
        reason: 'no_session',
      });
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const userRole = (session.user as { role?: string }).role;

    if (!userRole || !isValidUserRole(userRole)) {
      console.warn('[RBAC] 403 forbidden', {
        pathname,
        method,
        requiredRole: options.requiredRole,
        userRole: userRole ?? null,
        reason: 'invalid_role',
      });
      return NextResponse.json(
        { ok: false, error: 'Некорректная роль пользователя' },
        { status: 403 }
      );
    }

    if (!hasRoleLevel(userRole as UserRole, options.requiredRole)) {
      console.warn('[RBAC] 403 forbidden', {
        pathname,
        method,
        requiredRole: options.requiredRole,
        userRole,
        reason: 'insufficient_role',
      });
      return NextResponse.json(
        { ok: false, error: options.forbiddenMessage || 'Доступ запрещён: недостаточно прав' },
        { status: 403 }
      );
    }

    return handler(req, session as SessionWithUserAndRole);
  };
}

/**
 * Утилита для получения сессии и роли внутри API роута.
 * Возвращает null, если пользователь не авторизован.
 */
export async function getSessionWithRole() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const role = session.user.role as string;
  if (!isValidUserRole(role)) {
    return null;
  }

  return {
    session,
    role: role as UserRole,
  };
}
