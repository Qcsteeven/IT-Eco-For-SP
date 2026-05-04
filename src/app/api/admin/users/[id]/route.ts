// PATCH /api/admin/users/[id]/role — изменение роли пользователя (admin only)
// DELETE /api/admin/users/[id] — удаление пользователя (admin only)

import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';
import { isValidUserRole, UserRole } from '@/lib/rbac';

type AdminUpdateUserBody = {
  email?: string;
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

async function countActiveAdmins(db: Awaited<ReturnType<typeof getDB>>) {
  const result = await db.query(
    `SELECT count() AS count
     FROM users
     WHERE role = 'admin' AND is_blocked != true
     GROUP ALL;`,
  );
  const row = getResultArray(result)[0] as Record<string, unknown> | undefined;
  return Number(row?.count || 0);
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

// ==========================================
// PATCH — обновление пользователя
// ==========================================

const patchHandler = withRoleGuard(
  async (req: NextRequest, session) => {
    try {
      const urlPath = req.url.split('/api/admin/users/')[1];
      const userId = urlPath?.split('/role')[0];

      if (!userId) {
        return NextResponse.json(
          { ok: false, error: 'ID пользователя не указан' },
          { status: 400 }
        );
      }

      const body = (await req.json()) as AdminUpdateUserBody;
      const db = await getDB();
      const userThingId = userId.startsWith('users:') ? userId : `users:${userId}`;

      const existingResult = await db.query(
        'SELECT id, email, role, is_blocked FROM type::thing($id) LIMIT 1',
        { id: userThingId },
      );
      const existingUser = getResultArray(existingResult)[0] as
        | Record<string, unknown>
        | undefined;
      if (!existingUser) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 },
        );
      }

      const update: Record<string, unknown> = {};
      if (body.email !== undefined) update.email = body.email.trim().toLowerCase();
      if (body.full_name !== undefined) update.full_name = body.full_name.trim();
      if (body.phone !== undefined) update.phone = body.phone.trim();
      if (body.is_verified !== undefined) update.is_verified = !!body.is_verified;
      if (body.is_blocked !== undefined) update.is_blocked = !!body.is_blocked;
      if (body.role !== undefined) {
        if (!isValidUserRole(body.role)) {
          return NextResponse.json(
            { ok: false, error: 'Некорректная роль. Допустимые: guest, user, coach, admin' },
            { status: 400 },
          );
        }
        update.role = body.role as UserRole;
      }

      if (Object.keys(update).length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Нет полей для обновления' },
          { status: 400 },
        );
      }

      const currentRole = String(existingUser.role || 'user');
      const nextRole = String(update.role || currentRole);
      const willBlock = update.is_blocked === true || existingUser.is_blocked === true;
      if (currentRole === 'admin' && (nextRole !== 'admin' || willBlock)) {
        const activeAdmins = await countActiveAdmins(db);
        if (activeAdmins <= 1) {
          return NextResponse.json(
            { ok: false, error: 'Нельзя убрать или заблокировать последнего активного администратора' },
            { status: 409 },
          );
        }
      }

      const result = (await db.query(
        'UPDATE type::thing($id) MERGE $update',
        { id: userThingId, update }
      )) as unknown;

      const updatedUser = getResultArray(result)[0] ?? null;

      if (!updatedUser) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 }
        );
      }

      await writeAdminAudit(db, session.user.id, 'user.update', userThingId, {
        before: {
          email: existingUser.email,
          role: existingUser.role,
          is_blocked: existingUser.is_blocked,
        },
        update,
      });

      return NextResponse.json({
        ok: true,
        data: updatedUser,
        message: 'Пользователь обновлён',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Users] Ошибка обновления пользователя:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось обновить пользователя' },
        { status: 500 }
      );
    }
  },
  { requiredRole: 'admin' }
);

export { patchHandler as PATCH };

// ==========================================
// DELETE — удаление пользователя
// ==========================================

const deleteHandler = withRoleGuard(
  async (req: NextRequest, session) => {
    try {
      const urlPath = req.url.split('/api/admin/users/')[1];
      const userId = urlPath?.split('/')[0];

      if (!userId) {
        return NextResponse.json(
          { ok: false, error: 'ID пользователя не указан' },
          { status: 400 }
        );
      }

      const db = await getDB();
      const userThingId = userId.startsWith('users:') ? userId : `users:${userId}`;
      const existingResult = await db.query(
        'SELECT id, email, role, is_blocked FROM type::thing($id) LIMIT 1',
        { id: userThingId },
      );
      const existingUser = getResultArray(existingResult)[0] as
        | Record<string, unknown>
        | undefined;
      if (!existingUser) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 },
        );
      }

      if (existingUser.role === 'admin') {
        const activeAdmins = await countActiveAdmins(db);
        if (activeAdmins <= 1) {
          return NextResponse.json(
            { ok: false, error: 'Нельзя удалить последнего активного администратора' },
            { status: 409 },
          );
        }
      }

      await db.query('DELETE type::thing($id)', { id: userThingId });
      await writeAdminAudit(db, session.user.id, 'user.delete', userThingId, {
        email: existingUser.email,
        role: existingUser.role,
      });

      return NextResponse.json({
        ok: true,
        message: 'Пользователь удалён',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Users/Delete] Ошибка удаления пользователя:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось удалить пользователя' },
        { status: 500 }
      );
    }
  },
  { requiredRole: 'admin' }
);

export { deleteHandler as DELETE };
