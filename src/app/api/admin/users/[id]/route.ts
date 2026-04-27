// PATCH /api/admin/users/[id]/role — изменение роли пользователя (admin only)
// DELETE /api/admin/users/[id] — удаление пользователя (admin only)

import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';
import { isValidUserRole, UserRole } from '@/lib/rbac';

// ==========================================
// PATCH — обновление роли пользователя
// ==========================================

const patchHandler = withRoleGuard(
  async (req: NextRequest, _session) => {
    try {
      void _session;
      const urlPath = req.url.split('/api/admin/users/')[1];
      const userId = urlPath?.split('/role')[0];

      if (!userId) {
        return NextResponse.json(
          { ok: false, error: 'ID пользователя не указан' },
          { status: 400 }
        );
      }

      const body = await req.json();
      const { role } = body as { role?: string };

      if (!role || !isValidUserRole(role)) {
        return NextResponse.json(
          { ok: false, error: 'Некорректная роль. Допустимые: user, coach, admin' },
          { status: 400 }
        );
      }

      const db = await getDB();

      const result = (await db.query(
        'UPDATE type::thing("users", $id) SET role = $role',
        { id: userId, role: role as UserRole }
      )) as unknown;

      const updatedUser =
        Array.isArray(result) && result[0] && typeof result[0] === 'object'
          ? (result[0] as { result?: unknown[] }).result?.[0] ?? null
          : null;

      if (!updatedUser) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ok: true,
        data: updatedUser,
        message: 'Роль пользователя обновлена',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Users/Role] Ошибка обновления роли:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось обновить роль пользователя' },
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
  async (req: NextRequest, _session) => {
    try {
      void _session;
      const urlPath = req.url.split('/api/admin/users/')[1];
      const userId = urlPath?.split('/')[0];

      if (!userId) {
        return NextResponse.json(
          { ok: false, error: 'ID пользователя не указан' },
          { status: 400 }
        );
      }

      const db = await getDB();

      await db.query('DELETE type::thing("users", $id)', { id: userId });

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
