// ==========================================
// Role Guard — защита API роутов по ролям
// ==========================================

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { UserRole, hasRoleLevel, isValidUserRole } from '@/lib/rbac';

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
    session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>
  ) => Promise<NextResponse>,
  options: RoleGuardOptions
) {
  return async function protectedHandler(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    const userRole = session.user.role as string;

    if (!isValidUserRole(userRole)) {
      return NextResponse.json(
        { error: 'Некорректная роль пользователя' },
        { status: 403 }
      );
    }

    if (!hasRoleLevel(userRole as UserRole, options.requiredRole)) {
      return NextResponse.json(
        { error: options.forbiddenMessage || 'Доступ запрещён: недостаточно прав' },
        { status: 403 }
      );
    }

    return handler(req, session as NonNullable<Awaited<ReturnType<typeof getServerSession>>>);
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
