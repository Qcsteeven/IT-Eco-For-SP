// GET /api/admin/analytics — аналитика для тренера/админа

import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';
import { toUserThingId } from '@/lib/surreal/ids';

const handler = withRoleGuard(
  async (_req: NextRequest, session) => {
    try {
      const db = await getDB();
      const userRole = session.user.role;
      const coachId = toUserThingId(session.user.id.toString());
      const scopedUserFilter =
        userRole === 'admin'
          ? ''
          : `WHERE id IN (
              SELECT VALUE user_id
              FROM group_members
              WHERE group_id IN (
                SELECT VALUE group_id
                FROM group_coaches
                WHERE coach_id = type::thing($coachId)
              )
            )`;
      const queryVars = userRole === 'admin' ? {} : { coachId };

      // Общая статистика
      const totalUsersResult = await db.query(
        `SELECT count() AS totalUsers FROM users ${scopedUserFilter} GROUP ALL`,
        queryVars,
      );
      const totalUsers = (totalUsersResult as unknown as Record<string, { result?: Array<Record<string, unknown>> }>)['0']?.result?.[0] as Record<string, number> | undefined;

      // Пользователи по ролям
      const usersByRoleResult = await db.query(
        `SELECT role, count() AS count FROM users ${scopedUserFilter} GROUP BY role`,
        queryVars,
      );
      const usersByRole = (usersByRoleResult as unknown as Record<string, { result?: unknown[] }>)['0']?.result || [];

      // Верифицированные vs неверифицированные
      const verificationStatsResult = await db.query(
        `SELECT is_verified, count() AS count FROM users ${scopedUserFilter} GROUP BY is_verified`,
        queryVars,
      );
      const verificationStats = (verificationStatsResult as unknown as Record<string, { result?: unknown[] }>)['0']?.result || [];

      // Для админа — дополнительная статистика
      let adminStats = {};
      if (userRole === 'admin') {
        // Активность за последнюю неделю
        const recentRegistrationsResult = await db.query(
          'SELECT count() AS count FROM users WHERE registration_date > time::now() - 7d GROUP ALL'
        );
        const recentRegistrations = (recentRegistrationsResult as unknown as Record<string, { result?: Array<Record<string, unknown>> }>)['0']?.result?.[0] as Record<string, number> | undefined;

        adminStats = {
          recentRegistrations: recentRegistrations?.count || 0,
        };
      }

      return NextResponse.json({
        ok: true,
        data: {
          totalUsers: totalUsers?.totalUsers || 0,
          usersByRole,
          verificationStats,
          ...adminStats,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Analytics] Ошибка получения аналитики:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось получить аналитику' },
        { status: 500 }
      );
    }
  },
  { requiredRole: 'coach' }
);

export { handler as GET };
