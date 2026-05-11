// ==========================================
// Role Guard — защита API роутов по ролям
// ==========================================

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { UserRole, hasRoleLevel, isValidUserRole } from '@/lib/rbac';
import { getDB } from '@/lib/surreal/surreal';
import { parseUsersRecordKey } from '@/lib/surreal/ids';

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

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    // Если аккаунт заблокирован/не верифицирован — ведём себя как гость (401)
    try {
      const db = await getDB();
      const key = parseUsersRecordKey(String((session.user as { id?: string }).id || ''));
      if (db && key) {
        const res = await db.query(
          `SELECT is_verified, is_blocked FROM type::thing("users", $id) LIMIT 1;`,
          { id: key },
        );
        const rows = (Array.isArray(res) ? (res[0] as unknown[]) : []) || [];
        const row = (rows[0] as Record<string, unknown> | undefined) || undefined;
        const isVerified = row?.is_verified;
        const isBlocked = row?.is_blocked;
        if (isBlocked === true || isVerified === false) {
          return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
        }
      }
    } catch {
      // Если БД недоступна — не даём выполнять защищённые действия
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;

    if (!userRole || !isValidUserRole(userRole)) {
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

  // Неактивные аккаунты считаем гостями
  try {
    const db = await getDB();
    const key = parseUsersRecordKey(String((session.user as { id?: string }).id || ''));
    if (db && key) {
      const res = await db.query(
        `SELECT is_verified, is_blocked FROM type::thing("users", $id) LIMIT 1;`,
        { id: key },
      );
      const rows = (Array.isArray(res) ? (res[0] as unknown[]) : []) || [];
      const row = (rows[0] as Record<string, unknown> | undefined) || undefined;
      if (row?.is_blocked === true || row?.is_verified === false) return null;
    }
  } catch {
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
