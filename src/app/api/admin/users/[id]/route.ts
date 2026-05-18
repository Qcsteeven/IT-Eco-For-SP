import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { hashPassword } from '@/lib/surreal/auth';
import { withRoleGuard } from '@/lib/rbac/guard';
import { isValidUserRole, UserRole } from '@/lib/rbac';
import { parseUsersRecordKey } from '@/lib/surreal/ids';

type UserRow = Record<string, unknown>;

interface UpdateUserBody {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: string;
  is_verified?: boolean;
  is_blocked?: boolean;
  bscp_rating?: number | string;
}

function rowsFromQuery(result: unknown): UserRow[] {
  if (!Array.isArray(result)) return [];

  const first = result[0] as { result?: unknown } | undefined;
  if (Array.isArray(first)) {
    return first.filter(
      (row): row is UserRow => typeof row === 'object' && row !== null,
    );
  }

  if (first && typeof first === 'object' && Array.isArray(first.result)) {
    return first.result.filter(
      (row): row is UserRow => typeof row === 'object' && row !== null,
    );
  }

  return result.filter(
    (row): row is UserRow => typeof row === 'object' && row !== null,
  );
}

function normalizeUserId(value: unknown): string {
  if (value == null) return '';

  if (typeof value === 'string') {
    const decoded = decodeURIComponent(value);
    return decoded.includes(':')
      ? (decoded.split(':').pop() ?? decoded)
      : decoded;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.id != null) return normalizeUserId(record.id);
  }

  return String(value);
}

function getUserId(req: NextRequest): string {
  const urlPath = req.url.split('/api/admin/users/')[1];
  return normalizeUserId(urlPath?.split('/')[0]);
}

function serializeUser(row: UserRow) {
  return {
    id: normalizeUserId(row.id),
    email: String(row.email ?? ''),
    full_name: String(row.full_name ?? ''),
    phone: String(row.phone ?? ''),
    role: String(row.role ?? 'user'),
    is_verified: Boolean(row.is_verified),
    is_blocked: Boolean(row.is_blocked),
    registration_date: String(row.registration_date ?? ''),
    bscp_rating: Number(row.bscp_rating ?? row.karma ?? 0),
    karma: Number(row.karma ?? 0),
    codeforces_karma: Number(row.codeforces_karma ?? 0),
  };
}

function getRating(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const rating = Number(value);
  return Number.isFinite(rating) ? rating : Number.NaN;
}

const selectUserFields = `
  SELECT
    id,
    email,
    full_name,
    phone,
    role,
    is_verified,
    is_blocked,
    registration_date,
    bscp_rating,
    karma,
    codeforces_karma
  FROM type::thing("users", $id)
`;

async function countActiveAdmins(db: Awaited<ReturnType<typeof getDB>>) {
  const result = await db.query(
    `SELECT count() AS count
     FROM users
     WHERE role = 'admin' AND is_blocked != true
     GROUP ALL;`,
  );
  const row = rowsFromQuery(result)[0];
  return Number(row?.count ?? 0);
}

async function writeAdminAudit(
  db: Awaited<ReturnType<typeof getDB>>,
  adminId: string,
  action: string,
  targetUserId: string,
  details: Record<string, unknown>,
) {
  try {
    const adminKey = parseUsersRecordKey(adminId);
    const targetKey = parseUsersRecordKey(targetUserId);
    if (!adminKey || !targetKey) return;

    await db.query(
      `CREATE admin_audit_logs CONTENT {
        admin_id: type::thing("users", $adminId),
        action: $action,
        target_user_id: type::thing("users", $targetUserId),
        details: $details,
        created_at: time::now()
      };`,
      { adminId: adminKey, action, targetUserId: targetKey, details },
    );
  } catch (error) {
    console.warn('[Admin/Users] Не удалось записать audit log:', error);
  }
}

const patchHandler = withRoleGuard(
  async (req: NextRequest, session) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return NextResponse.json(
          { ok: false, error: 'ID пользователя не указан' },
          { status: 400 },
        );
      }

      const body = (await req.json()) as UpdateUserBody;
      const updateData: Record<string, unknown> = {};
      const db = await getDB();
      const existingUser = rowsFromQuery(
        await db.query(
          `SELECT id, email, role, is_blocked
           FROM type::thing("users", $id)
           LIMIT 1`,
          { id: userId },
        ),
      )[0];

      if (!existingUser) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 },
        );
      }

      if (body.email !== undefined) {
        const email = body.email.trim().toLowerCase();
        if (!email) {
          return NextResponse.json(
            { ok: false, error: 'Email не может быть пустым' },
            { status: 400 },
          );
        }
        updateData.email = email;
      }

      if (body.full_name !== undefined)
        updateData.full_name = body.full_name.trim();
      if (body.phone !== undefined) updateData.phone = body.phone.trim();

      if (body.role !== undefined) {
        if (!isValidUserRole(body.role)) {
          return NextResponse.json(
            { ok: false, error: 'Некорректная роль пользователя' },
            { status: 400 },
          );
        }
        updateData.role = body.role as UserRole;
      }

      if (body.is_verified !== undefined)
        updateData.is_verified = Boolean(body.is_verified);
      if (body.is_blocked !== undefined)
        updateData.is_blocked = Boolean(body.is_blocked);

      if (body.bscp_rating !== undefined) {
        const rating = getRating(body.bscp_rating);
        if (Number.isNaN(rating)) {
          return NextResponse.json(
            { ok: false, error: 'Рейтинг должен быть числом' },
            { status: 400 },
          );
        }
        updateData.bscp_rating = rating;
      }

      if (body.password !== undefined && body.password.trim()) {
        if (body.password.length < 6) {
          return NextResponse.json(
            { ok: false, error: 'Пароль должен быть не короче 6 символов' },
            { status: 400 },
          );
        }
        updateData.password_hash = await hashPassword(body.password);
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Нет данных для обновления' },
          { status: 400 },
        );
      }

      if (typeof updateData.email === 'string') {
        const duplicate = rowsFromQuery(
          await db.query(
            'SELECT id FROM users WHERE email = $email AND id != type::thing("users", $id) LIMIT 1',
            { email: updateData.email, id: userId },
          ),
        );

        if (duplicate.length > 0) {
          return NextResponse.json(
            { ok: false, error: 'Пользователь с таким email уже существует' },
            { status: 409 },
          );
        }
      }

      const currentRole = String(existingUser.role ?? 'user');
      const nextRole = String(updateData.role ?? currentRole);
      const currentlyActiveAdmin =
        currentRole === 'admin' && existingUser.is_blocked !== true;
      const willStopBeingActiveAdmin =
        nextRole !== 'admin' || updateData.is_blocked === true;

      if (currentlyActiveAdmin && willStopBeingActiveAdmin) {
        const activeAdmins = await countActiveAdmins(db);
        if (activeAdmins <= 1) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'Нельзя убрать или заблокировать последнего активного администратора',
            },
            { status: 409 },
          );
        }
      }

      await db.query('UPDATE type::thing("users", $id) MERGE $data', {
        id: userId,
        data: updateData,
      });

      const updatedUser = rowsFromQuery(
        await db.query(selectUserFields, { id: userId }),
      )[0];

      if (!updatedUser) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 },
        );
      }

      await writeAdminAudit(db, session.user.id, 'user.update', userId, {
        before: {
          email: existingUser.email,
          role: existingUser.role,
          is_blocked: existingUser.is_blocked,
        },
        update: updateData,
      });

      return NextResponse.json({
        ok: true,
        data: serializeUser(updatedUser),
        message: 'Пользователь обновлен',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[Admin/Users] Failed to update user:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось обновить пользователя' },
        { status: 500 },
      );
    }
  },
  { requiredRole: 'admin' },
);

const deleteHandler = withRoleGuard(
  async (req: NextRequest, session) => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        return NextResponse.json(
          { ok: false, error: 'ID пользователя не указан' },
          { status: 400 },
        );
      }

      const db = await getDB();
      const existingUser = rowsFromQuery(
        await db.query(
          `SELECT id, email, role, is_blocked
           FROM type::thing("users", $id)
           LIMIT 1`,
          { id: userId },
        ),
      )[0];

      if (!existingUser) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 },
        );
      }

      if (existingUser.role === 'admin' && existingUser.is_blocked !== true) {
        const activeAdmins = await countActiveAdmins(db);
        if (activeAdmins <= 1) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Нельзя удалить последнего активного администратора',
            },
            { status: 409 },
          );
        }
      }

      await db.query('DELETE type::thing("users", $id)', { id: userId });
      await writeAdminAudit(db, session.user.id, 'user.delete', userId, {
        email: existingUser.email,
        role: existingUser.role,
      });

      return NextResponse.json({
        ok: true,
        message: 'Пользователь удален',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[Admin/Users] Failed to delete user:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось удалить пользователя' },
        { status: 500 },
      );
    }
  },
  { requiredRole: 'admin' },
);

export { patchHandler as PATCH, deleteHandler as DELETE };
