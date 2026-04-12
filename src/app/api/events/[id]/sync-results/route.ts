import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import axios from 'axios';
import type { Event } from '@/lib/types/event';

/**
 * POST /api/events/[id]/sync-results
 *
 * Синхронизация результатов участников private контеста с Codeforces.
 * Вызывается после завершения мероприятия для обновления рейтинга и кармы.
 *
 * Логика:
 * 1. Проверяем что мероприятие завершено (status = 'completed')
 * 2. Получаем participant_list мероприятия
 * 3. Для каждого участника с привязанным CF аккаунтом:
 *    - Запрашиваем submission'ы за период контеста
 *    - Обновляем codeforces_karma
 *    - Обновляем total_karma
 *
 * Доступно только coach (свои мероприятия) и admin.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    // Только coach и admin
    if (session.user.role !== 'coach' && session.user.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Доступно только тренерам и администраторам' },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const eventId = url.pathname.split('/')[3]; // /api/events/[id]/sync-results

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: 'Не указан ID мероприятия' },
        { status: 400 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    // Получаем мероприятие
    const eventResult = await db.query(
      `SELECT * FROM type::thing($tableName, $id)`,
      { tableName: 'contests', id: eventId },
    );
    const event = (eventResult[0] as unknown as Event[])?.[0];

    if (!event) {
      return NextResponse.json(
        { ok: false, error: 'Мероприятие не найдено' },
        { status: 404 },
      );
    }

    // Проверяем доступы coach
    if (session.user.role === 'coach') {
      const createdBy = event.created_by as string | undefined;
      const userId = `users:${session.user.id}`;
      if (createdBy !== userId) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Вы можете синхронизировать только свои мероприятия',
          },
          { status: 403 },
        );
      }
    }

    // Проверяем что мероприятие private
    if (event.visibility_type !== 'private') {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Синхронизация результатов доступна только для private мероприятий',
        },
        { status: 400 },
      );
    }

    const participantList = (event.participant_list as string[]) || [];
    const startTime = event.start_time_utc;
    const endTime = event.end_time_utc;

    console.log(
      `[Event Sync] Syncing results for event "${event.title}"`,
      `Participants: ${participantList.length}`,
      `Period: ${startTime} - ${endTime}`,
    );

    // Для каждого участника получаем CF handle и синхронизируем
    const syncResults: Array<{
      userId: string;
      cfHandle: string;
      solved: number;
      karma: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const userId of participantList) {
      try {
        // Получаем CF handle участника
        const cfQuery = await db.query(
          `SELECT
            (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($userId) AND platform_name = 'codeforces' AND is_verified = true LIMIT 1)[0] AS cf_username
          FROM type::thing($userId)`,
          { userId },
        );
        const cfResult = (cfQuery[0] as Record<string, unknown>[])?.[0];
        const cfHandle = cfResult?.cf_username as string | undefined;

        if (!cfHandle) {
          syncResults.push({
            userId,
            cfHandle: '',
            solved: 0,
            karma: 0,
            success: false,
            error: 'CF аккаунт не привязан',
          });
          continue;
        }

        // Получаем submission'ы пользователя
        const submissionsRes = await axios.get(
          `https://codeforces.com/api/user.status?handle=${cfHandle}&from=1&count=5000`,
          { timeout: 10000 },
        );

        if (submissionsRes.data.status !== 'OK') {
          syncResults.push({
            userId,
            cfHandle,
            solved: 0,
            karma: 0,
            success: false,
            error: 'Ошибка Codeforces API',
          });
          continue;
        }

        const submissions = submissionsRes.data.result;

        // Фильтруем submission'ы за период контеста
        const startTimestamp = Math.floor(new Date(startTime).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);

        const contestSubmissions = submissions.filter(
          (s: { creationTimeSeconds: number; verdict: string }) =>
            s.creationTimeSeconds >= startTimestamp &&
            s.creationTimeSeconds <= endTimestamp &&
            s.verdict === 'OK',
        );

        // Уникальные задачи
        const uniqueProblems = new Map<string, unknown>();
        for (const sub of contestSubmissions) {
          const problemIndex = sub.problem?.index || sub.problemIndex;
          if (!sub.contestId || !problemIndex) continue;
          const key = `${sub.contestId}-${problemIndex}`;
          if (!uniqueProblems.has(key)) {
            uniqueProblems.set(key, sub);
          }
        }

        // Считаем карму
        let easyCount = 0;
        let mediumCount = 0;
        let hardCount = 0;

        uniqueProblems.forEach((sub: unknown) => {
          const s = sub as Record<string, unknown>;
          const problem = s.problem as Record<string, unknown> | undefined;
          const rating = problem?.rating as number | undefined;
          if (rating) {
            if (rating < 1200) easyCount++;
            else if (rating < 2000) mediumCount++;
            else hardCount++;
          }
        });

        const contestKarma = easyCount * 1 + mediumCount * 3 + hardCount * 10;

        syncResults.push({
          userId,
          cfHandle,
          solved: uniqueProblems.size,
          karma: contestKarma,
          success: true,
        });
      } catch (e) {
        syncResults.push({
          userId,
          cfHandle: '',
          solved: 0,
          karma: 0,
          success: false,
          error: e instanceof Error ? e.message : 'Неизвестная ошибка',
        });
      }
    }

    const successCount = syncResults.filter((r) => r.success).length;
    const totalKarma = syncResults.reduce((sum, r) => sum + r.karma, 0);

    return NextResponse.json(
      {
        ok: true,
        data: {
          event_id: eventId,
          event_title: event.title,
          participants_synced: participantList.length,
          successful: successCount,
          failed: participantList.length - successCount,
          total_karma_awarded: totalKarma,
          details: syncResults,
        },
        message: `Синхронизация завершена: ${successCount}/${participantList.length} участников`,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API Sync Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}
