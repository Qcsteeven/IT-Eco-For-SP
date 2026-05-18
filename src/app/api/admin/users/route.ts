import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import { getDB } from '@/lib/surreal/surreal';
import { hashPassword } from '@/lib/surreal/auth';
import { withRoleGuard } from '@/lib/rbac/guard';
import { getDefaultUserRole, isValidUserRole, UserRole } from '@/lib/rbac';
import { parseUsersRecordKey } from '@/lib/surreal/ids';

type UserRow = Record<string, unknown>;

interface CreateUserBody {
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

function serializeUser(row: UserRow) {
  return {
    id: normalizeUserId(row.id),
    email: String(row.email ?? ''),
    full_name: String(row.full_name ?? ''),
    phone: String(row.phone ?? ''),
    role: String(row.role ?? getDefaultUserRole()),
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
  FROM users
`;

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

const getHandler = withRoleGuard(
  async () => {
    try {
      const db = await getDB();
      const result = await db.query(
        `${selectUserFields} ORDER BY registration_date DESC`,
      );
      const users = rowsFromQuery(result).map(serializeUser);

      return NextResponse.json({
        ok: true,
        data: users,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[Admin/Users] Failed to load users:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось получить список пользователей' },
        { status: 500 },
      );
    }
  },
  { requiredRole: 'admin' },
);

const postHandler = withRoleGuard(
  async (req: NextRequest, session) => {
    try {
      const body = (await req.json()) as CreateUserBody;
      const email = body.email?.trim().toLowerCase() ?? '';
      const fullName = body.full_name?.trim() ?? '';
      const password = body.password ?? '';
      const role: UserRole =
        body.role && isValidUserRole(body.role)
          ? body.role
          : getDefaultUserRole();
      const rating = getRating(body.bscp_rating);

      if (!email || !password || !fullName) {
        return NextResponse.json(
          { ok: false, error: 'Заполните email, ФИО и пароль' },
          { status: 400 },
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { ok: false, error: 'Пароль должен быть не короче 6 символов' },
          { status: 400 },
        );
      }

      if (Number.isNaN(rating)) {
        return NextResponse.json(
          { ok: false, error: 'Рейтинг должен быть числом' },
          { status: 400 },
        );
      }

      const db = await getDB();
      const existing = rowsFromQuery(
        await db.query('SELECT id FROM users WHERE email = $email LIMIT 1', {
          email,
        }),
      );

      if (existing.length > 0) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь с таким email уже существует' },
          { status: 409 },
        );
      }

      await db.create('users', {
        email,
        password_hash: await hashPassword(password),
        full_name: fullName,
        phone: body.phone?.trim() ?? '',
        role,
        is_verified: body.is_verified ?? true,
        is_blocked: body.is_blocked ?? false,
        verification_code: crypto.randomInt(100000, 999999).toString(),
        code_expiry: new Date(Date.now() + 60 * 60 * 1000),
        registration_date: new Date(),
        bscp_rating: rating,
        karma: 0,
        codeforces_karma: 0,
      });

      const created = rowsFromQuery(
        await db.query(`${selectUserFields} WHERE email = $email LIMIT 1`, {
          email,
        }),
      )[0];

      if (created) {
        await writeAdminAudit(
          db,
          session.user.id,
          'user.create',
          normalizeUserId(created.id),
          { email, role },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          data: created ? serializeUser(created) : null,
          message: 'Пользователь создан',
        },
        { status: 201 },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[Admin/Users] Failed to create user:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось создать пользователя' },
        { status: 500 },
      );
    }
  },
  { requiredRole: 'admin' },
);

export { getHandler as GET, postHandler as POST };
