import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/authOptions';
import {
  combineCachedKarmaWithManualAdjustment,
  getManualKarmaAdjustment,
  getStoredCodeforcesTaskKarma,
  recordId,
  rowsFromQuery,
  storedOnlyKarmaResponse,
  syncCodeforcesKarmaForUser,
} from '@/lib/codeforces/karma-service';
import { getDB } from '@/lib/surreal/surreal';

/**
 * GET /api/codeforces/karma
 *
 * Возвращает итоговую карму пользователя:
 * - loadedKarma: рассчитано по решённым задачам Codeforces
 * - manualAdjustment: сумма amount из karma_logs
 * - karma: loadedKarma + manualAdjustment
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    const db = await getDB();
    const userId = session.user.id.toString();
    const forceRefresh =
      req.nextUrl.searchParams.get('refresh') === '1' ||
      req.nextUrl.searchParams.get('refresh') === 'true';

    const account = rowsFromQuery(
      await db.query(
        `SELECT id, handle_username, updated_at, cached_karma
         FROM external_accounts
         WHERE user_id = type::thing($userId)
           AND platform_name = 'codeforces'
           AND is_verified = true
         LIMIT 1`,
        { userId },
      ),
    )[0];

    if (!account?.handle_username) {
      return NextResponse.json(
        { ok: false, error: 'Codeforces аккаунт не привязан' },
        { status: 400 },
      );
    }

    const manualAdjustment = await getManualKarmaAdjustment(db, userId);
    if (!forceRefresh) {
      const cached = combineCachedKarmaWithManualAdjustment(
        account.cached_karma,
        manualAdjustment,
      );

      if (cached) {
        return NextResponse.json(cached);
      }

      return NextResponse.json(
        storedOnlyKarmaResponse(
          await getStoredCodeforcesTaskKarma(db, userId),
          manualAdjustment,
          'Детальная статистика ещё не закеширована, показана карма из БД',
        ),
      );
    }

    try {
      const response = await syncCodeforcesKarmaForUser({
        db,
        userId,
        accountId: recordId(account.id),
        handle: String(account.handle_username),
        cachedKarma: account.cached_karma,
      });

      return NextResponse.json(response);
    } catch (error) {
      const fallback = (error as { fallback?: unknown }).fallback;
      if (fallback) {
        return NextResponse.json(fallback);
      }

      const response = storedOnlyKarmaResponse(
        await getStoredCodeforcesTaskKarma(db, userId),
        manualAdjustment,
        'Codeforces сейчас не ответил, показаны сохранённые значения из БД',
      );
      return NextResponse.json(response);
    }
  } catch (err: unknown) {
    console.error('[CF Karma] API Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Неизвестная ошибка',
      },
      { status: 500 },
    );
  }
}
