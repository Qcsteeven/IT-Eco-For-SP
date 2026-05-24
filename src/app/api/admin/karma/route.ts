import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';
import { parseUsersRecordKey } from '@/lib/surreal/ids';
import {
  getManualKarmaAdjustment,
  getStoredCodeforcesTaskKarma,
} from '@/lib/codeforces/karma-service';

type DbRow = Record<string, unknown>;

interface KarmaAdjustmentBody {
  userId?: string;
  amount?: number;
  reason?: string;
}

function rowsFromQuery(result: unknown): DbRow[] {
  if (!Array.isArray(result)) return [];

  const first = result[0] as { result?: unknown } | undefined;
  if (Array.isArray(first)) {
    return first.filter(
      (row): row is DbRow => typeof row === 'object' && row !== null,
    );
  }

  if (first && typeof first === 'object' && Array.isArray(first.result)) {
    return first.result.filter(
      (row): row is DbRow => typeof row === 'object' && row !== null,
    );
  }

  return result.filter(
    (row): row is DbRow => typeof row === 'object' && row !== null,
  );
}

function normalizeId(value: unknown): string {
  if (value == null) return '';

  if (typeof value === 'string') {
    const decoded = decodeURIComponent(value);
    return decoded.includes(':')
      ? (decoded.split(':').pop() ?? decoded)
      : decoded;
  }

  if (typeof value === 'object') {
    const record = value as DbRow;
    if (record.id != null) return normalizeId(record.id);
    if (record.String != null) return normalizeId(record.String);
  }

  return String(value);
}

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isoDate(value: unknown) {
  const raw = text(value);
  if (!raw) return '';

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

function serializeKarmaLog(row: DbRow) {
  const user = row.user as DbRow | undefined;
  const userEmail = text(
    row.user_email || row.email || user?.email || normalizeId(row.user),
  );
  const date = isoDate(row.created_at || row.date);

  return {
    id: normalizeId(row.id) || `${userEmail}-${date}-${text(row.amount)}`,
    user_email: userEmail,
    user_name: text(row.user_name || row.full_name || user?.full_name),
    amount: number(row.amount),
    reason: text(row.reason, 'Ручная корректировка'),
    date,
  };
}

const getHandler = withRoleGuard(
  async () => {
    try {
      const db = await getDB();
      const result = await db.query(
        `SELECT
          id,
          user,
          user_email,
          user_name,
          amount,
          reason,
          created_at
        FROM karma_logs
        ORDER BY created_at DESC
        LIMIT 80`,
      );

      return NextResponse.json({
        ok: true,
        data: rowsFromQuery(result).map(serializeKarmaLog),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[Admin/Karma] Failed to load karma logs:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось получить историю кармы' },
        { status: 500 },
      );
    }
  },
  { requiredRole: 'admin' },
);

const postHandler = withRoleGuard(
  async (req: NextRequest, session) => {
    try {
      const body = (await req.json()) as KarmaAdjustmentBody;
      const userId = normalizeId(body.userId);
      const amount = number(body.amount, Number.NaN);
      const reason = body.reason?.trim() || 'Ручная корректировка';

      if (!userId || !Number.isFinite(amount) || amount === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Необходимы пользователь и ненулевое изменение кармы',
          },
          { status: 400 },
        );
      }

      const db = await getDB();
      const recordKey = parseUsersRecordKey(userId);
      if (!recordKey) {
        return NextResponse.json(
          { ok: false, error: 'Некорректный ID пользователя' },
          { status: 400 },
        );
      }

      const user = rowsFromQuery(
        await db.query(
          `SELECT id, email, full_name, codeforces_karma, karma, bscp_rating
           FROM type::thing("users", $id)`,
          { id: recordKey },
        ),
      )[0];

      if (!user) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 },
        );
      }

      const userThingId = `users:${recordKey}`;
      const currentKarma = await getManualKarmaAdjustment(db, userThingId);
      const userEmail = text(user.email);
      const userName = text(user.full_name);

      await db.query(
        `CREATE karma_logs CONTENT {
          user: type::thing("users", $userId),
          user_email: $userEmail,
          user_name: $userName,
          amount: $amount,
          reason: $reason,
          admin_id: $adminId,
          created_at: time::now()
        }`,
        {
          userId: recordKey,
          userEmail,
          userName,
          amount,
          reason,
          adminId: parseUsersRecordKey(session.user.id),
        },
      );

      const newKarma = await getManualKarmaAdjustment(db, userThingId);
      const loadedKarma = await getStoredCodeforcesTaskKarma(db, userThingId);
      const finalKarma = loadedKarma + newKarma;

      return NextResponse.json({
        ok: true,
        data: {
          userId,
          previousKarma: currentKarma,
          newKarma,
          finalKarma,
          adjustment: amount,
          reason,
        },
        message: 'Карма обновлена',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[Admin/Karma] Failed to adjust karma:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось скорректировать карму' },
        { status: 500 },
      );
    }
  },
  { requiredRole: 'admin' },
);

export { getHandler as GET, postHandler as POST };
