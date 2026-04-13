// GET /api/admin/users — получение списка всех пользователей (admin only)

import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';

const handler = withRoleGuard(
  async (_req: NextRequest, session) => {
    try {
      const db = await getDB();

      const result = await db.query(
        'SELECT id, email, full_name, role, is_verified, registration_date FROM users ORDER BY registration_date DESC'
      );

      const usersArray = result && typeof result === 'object' && '0' in result
        ? (result as Record<string, { result?: unknown[] }>)['0']?.result || []
        : [];

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

export { handler as GET };
