// GET /api/admin/users — получение списка всех пользователей (admin only)
// POST /api/admin/users — создание пользователя администратором

import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';
import { hashPassword } from '@/lib/surreal/auth';
import { getDefaultUserRole, isValidUserRole, UserRole } from '@/lib/rbac';

type AdminCreateUserBody = {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: string;
  is_verified?: boolean;
  is_blocked?: boolean;
};

function getResultArray(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    const first = result[0] as unknown;
    if (Array.isArray(first)) return first;
    if (first && typeof first === 'object' && 'result' in first) {
      return ((first as { result?: unknown[] }).result ?? []);
    }
  }
  return [];
}

function toRecordIdString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const anyV = v as Record<string, unknown>;
    if (typeof anyV.id === 'string') return anyV.id;
    if (typeof anyV.tb === 'string' && anyV.id != null) return `${anyV.tb}:${String(anyV.id)}`;
  }
  return String(v);
}

async function writeAdminAudit(
  db: Awaited<ReturnType<typeof getDB>>,
  adminId: string,
  action: string,
  targetUserId: string,
  details: Record<string, unknown>,
) {
  try {
    await db.query(
      `CREATE admin_audit_logs CONTENT {
        admin_id: type::thing("users", $adminId),
        action: $action,
        target_user_id: type::thing($targetUserId),
        details: $details,
        created_at: time::now()
      };`,
      { adminId, action, targetUserId, details },
    );
  } catch (error) {
    console.warn('[Admin/Users] Не удалось записать audit log:', error);
  }
}

const getHandler = withRoleGuard(
  async (_req: NextRequest, session) => {
    try {
      void _req;
      void session;
      const db = await getDB();

      const result = (await db.query(
        `SELECT
          id,
          email,
          full_name,
          phone,
          role,
          is_verified,
          is_blocked,
          bscp_rating,
          codeforces_karma,
          registration_date
        FROM users
        ORDER BY registration_date DESC`
      )) as unknown;

      const usersArray = getResultArray(result).map((user) => {
        if (!user || typeof user !== 'object') return user;
        const row = user as Record<string, unknown>;
        return { ...row, id: toRecordIdString(row.id) };
      });

      return NextResponse.json({
        ok: true,
        data: usersArray,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Users] Ошибка получения пользователей:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось получить список пользователей' },
        { status: 500 }
      );
    }
  },
  { requiredRole: 'admin' }
);

const postHandler = withRoleGuard(
  async (req: NextRequest, session) => {
    try {
      const body = (await req.json()) as AdminCreateUserBody;
      const email = body.email?.trim().toLowerCase();
      const fullName = body.full_name?.trim();
      const password = body.password || '';
      const role: UserRole =
        body.role && isValidUserRole(body.role) ? body.role : getDefaultUserRole();

      if (!email || !fullName || !password) {
        return NextResponse.json(
          { ok: false, error: 'email, full_name и password обязательны' },
          { status: 400 },
        );
      }

      if (password.length < 8) {
        return NextResponse.json(
          { ok: false, error: 'Пароль должен быть не короче 8 символов' },
          { status: 400 },
        );
      }

      const db = await getDB();
      const duplicateResult = await db.query('SELECT id FROM users WHERE email = $email LIMIT 1', {
        email,
      });
      if (getResultArray(duplicateResult).length > 0) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь с таким email уже существует' },
          { status: 409 },
        );
      }

      const passwordHash = await hashPassword(password);
      const result = await db.query(
        `CREATE users CONTENT {
          email: $email,
          password_hash: $passwordHash,
          full_name: $fullName,
          phone: $phone,
          role: $role,
          is_verified: $isVerified,
          is_blocked: $isBlocked,
          registration_date: time::now()
        };`,
        {
          email,
          passwordHash,
          fullName,
          phone: body.phone?.trim() || '',
          role,
          isVerified: body.is_verified ?? true,
          isBlocked: body.is_blocked ?? false,
        },
      );

      const createdUserRaw = getResultArray(result)[0];
      const createdUser =
        createdUserRaw && typeof createdUserRaw === 'object'
          ? {
              ...(createdUserRaw as Record<string, unknown>),
              id: toRecordIdString((createdUserRaw as Record<string, unknown>).id),
            }
          : createdUserRaw;
      const targetUserId =
        createdUser && typeof createdUser === 'object'
          ? String((createdUser as Record<string, unknown>).id)
          : '';
      if (targetUserId) {
        await writeAdminAudit(db, session.user.id, 'user.create', targetUserId, {
          email,
          role,
        });
      }

      return NextResponse.json(
        { ok: true, data: createdUser, message: 'Пользователь создан' },
        { status: 201 },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Users] Ошибка создания пользователя:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось создать пользователя' },
        { status: 500 },
      );
    }
  },
  { requiredRole: 'admin' },
);

export { getHandler as GET, postHandler as POST };
