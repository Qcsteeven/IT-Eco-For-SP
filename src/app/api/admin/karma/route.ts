// POST /api/admin/karma — ручная корректировка кармы (admin only)

import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';

interface KarmaAdjustmentBody {
  userId: string;
  amount: number;
  reason?: string;
}

const handler = withRoleGuard(
  async (req: NextRequest, _session) => {
    try {
      const body = await req.json() as KarmaAdjustmentBody;
      const { userId, amount, reason } = body;

      if (!userId || amount === undefined || amount === null) {
        return NextResponse.json(
          { ok: false, error: 'Необходимы userId и amount' },
          { status: 400 }
        );
      }

      if (typeof amount !== 'number') {
        return NextResponse.json(
          { ok: false, error: 'amount должен быть числом' },
          { status: 400 }
        );
      }

      const db = await getDB();

      // Получаем текущего пользователя
      const userResult = await db.query(
        'SELECT * FROM type::thing("users", $id)',
        { id: userId }
      );

      const user = (userResult as unknown as Record<string, { result?: Array<Record<string, unknown>> }>)['0']?.result?.[0];

      if (!user) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 }
        );
      }

      const currentKarma = (user.karma as number) || 0;
      const newKarma = currentKarma + amount;

      // Обновляем карму и логируем изменение
      await db.query(
        'UPDATE type::thing("users", $id) SET karma = $karma',
        { id: userId, karma: newKarma }
      );

      // Логируем в таблицу karma_logs (если существует)
      try {
        await db.query(
          'CREATE karma_logs SET user = type::thing("users", $userId), amount = $amount, reason = $reason, admin_id = $adminId, created_at = time::now()',
          {
            userId,
            amount,
            reason: reason || 'Ручная корректировка',
            adminId: _session.user.id,
          }
        );
      } catch (logError) {
        console.warn('[Admin/Karma] Не удалось записать лог (таблица может не существовать):', logError);
      }

      return NextResponse.json({
        ok: true,
        data: {
          userId,
          previousKarma: currentKarma,
          newKarma,
          adjustment: amount,
          reason: reason || 'Ручная корректировка',
        },
        message: 'Карма обновлена',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Karma] Ошибка корректировки кармы:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось скорректировать карму' },
        { status: 500 }
      );
    }
  },
  { requiredRole: 'admin' }
);

export { handler as POST };
