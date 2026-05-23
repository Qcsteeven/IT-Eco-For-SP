// POST /api/admin/karma — ручная корректировка кармы (admin only)

import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';
import { parseUsersRecordKey } from '@/lib/surreal/ids';

function getFirstStatementRows(result: unknown): unknown[] {
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0];
    if (Array.isArray(first)) return first;
  }

  if (result && typeof result === 'object') {
    const first = (result as Record<string, { result?: unknown }>)['0']?.result;
    if (Array.isArray(first)) return first;
  }

  return [];
}

function toRecordIdString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tb === 'string' && record.id != null) {
      return `${record.tb}:${String(record.id)}`;
    }
    if (typeof record.id === 'string') return record.id;
  }

  return String(value);
}

function getFetchedUserEmail(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const user = value as Record<string, unknown>;
  return typeof user.email === 'string' ? user.email : '';
}

interface KarmaAdjustmentBody {
  userId: string;
  amount: number;
  reason?: string;
}

const getHandler = withRoleGuard(
  async () => {
    try {
      const db = await getDB();
      const result = await db.query(
        `SELECT id, user, amount, reason, created_at
         FROM karma_logs
         ORDER BY created_at DESC
         LIMIT 50
         FETCH user`,
      );

      const rows = getFirstStatementRows(result) as Record<string, unknown>[];
      const logs = rows.map((row, idx) => ({
        id: toRecordIdString(row.id) || `karma-log-${idx}`,
        user_email: getFetchedUserEmail(row.user),
        amount: Number(row.amount || 0),
        reason: typeof row.reason === 'string' ? row.reason : '',
        date: String(row.created_at || ''),
      }));

      return NextResponse.json({ ok: true, data: logs });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Karma] Ошибка получения истории кармы:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось получить историю кармы' },
        { status: 500 },
      );
    }
  },
  { requiredRole: 'admin' },
);

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

      const recordKey = parseUsersRecordKey(userId);
      if (!recordKey) {
        return NextResponse.json(
          { ok: false, error: 'Некорректный userId' },
          { status: 400 },
        );
      }

      const userResult = await db.query(
        'SELECT * FROM type::thing("users", $id)',
        { id: recordKey },
      );

      const rows = getFirstStatementRows(userResult);
      const user = rows[0] as Record<string, unknown> | undefined;

      if (!user || typeof user !== 'object') {
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 }
        );
      }

      const existingCf =
        typeof user.codeforces_karma === 'number' ? user.codeforces_karma : null;
      const legacyKarma =
        typeof user.karma === 'number' ? user.karma : null;
      const currentKarma = existingCf ?? legacyKarma ?? 0;
      const newKarma = currentKarma + amount;

      await db.query(
        'UPDATE type::thing("users", $id) SET codeforces_karma = $karma',
        { id: recordKey, karma: newKarma },
      );

      try {
        const adminKey = parseUsersRecordKey(String(_session.user.id));
        if (adminKey) {
          await db.query(
            'CREATE karma_logs SET user = type::thing("users", $userId), amount = $amount, reason = $reason, admin_id = type::thing("users", $adminKey), created_at = time::now()',
            {
              userId: recordKey,
              amount,
              reason: reason || 'Ручная корректировка',
              adminKey,
            },
          );
        }
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

export { getHandler as GET, handler as POST };
