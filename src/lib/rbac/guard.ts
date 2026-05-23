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

type ActiveSession = {
  session: SessionWithUserAndRole;
  role: UserRole;
};

export interface RoleGuardOptions {
  /** Минимальная требуемая роль */
  requiredRole: UserRole;
  /** Сообщение об ошибке при недостатке прав */
  forbiddenMessage?: string;
}

async function getActiveSession(
  session: Session,
): Promise<ActiveSession | null> {
  if (!session.user) return null;

  const db = await getDB();
  const key = parseUsersRecordKey(
    String((session.user as { id?: string }).id || ''),
  );

  if (!db || !key) return null;

  const res = await db.query(
    `SELECT role, is_verified, is_blocked
     FROM type::thing("users", $id)
     LIMIT 1;`,
    { id: key },
  );
  const rows = (Array.isArray(res) ? (res[0] as unknown[]) : []) || [];
  const row = (rows[0] as Record<string, unknown> | undefined) || undefined;

  if (!row || row.is_blocked === true || row.is_verified === false) {
    return null;
  }

  const role = String(row.role || '');
  if (!isValidUserRole(role)) return null;

  return {
    role: role as UserRole,
    session: {
      ...session,
      user: {
        ...session.user,
        role,
        is_verified: row.is_verified !== false,
        is_blocked: row.is_blocked === true,
      },
    } as SessionWithUserAndRole,
  };
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
    session: SessionWithUserAndRole,
  ) => Promise<NextResponse>,
  options: RoleGuardOptions,
) {
  return async function protectedHandler(
    req: NextRequest,
  ): Promise<NextResponse> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    let activeSession: ActiveSession | null = null;
    try {
      activeSession = await getActiveSession(session);
    } catch {
      // Если БД недоступна — не даём выполнять защищённые действия
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    if (!activeSession) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    if (!hasRoleLevel(activeSession.role, options.requiredRole)) {
      return NextResponse.json(
        {
          error:
            options.forbiddenMessage || 'Доступ запрещён: недостаточно прав',
        },
        { status: 403 },
      );
    }

    return handler(req, activeSession.session);
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

  try {
    const activeSession = await getActiveSession(session);
    if (!activeSession) return null;

    return activeSession;
  } catch {
    return null;
  }
}
