import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import axios from 'axios';
import {
  calculateKarma,
  getKarmaLevel,
  getKarmaColor,
} from '@/lib/codeforces/karma';
import type { CodeforcesSubmission, CodeforcesUser } from '@/types/codeforces';

/**
 * GET /api/codeforces/karma
 * Получает карму пользователя и детальную статистику
 */
export async function GET() {
  try {
    console.log('[CF Karma API] Starting...');
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('[CF Karma API] Not authenticated');
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Ошибка подключения к БД');

    const userId = session.user.id.toString();
    console.log('[CF Karma API] User ID:', userId);

    // Получаем верифицированный CF username и текущую карму пользователя
    const userQuery = await db.query(
      `
      SELECT
        id,
        codeforces_karma,
        (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces' AND is_verified = true LIMIT 1)[0] AS cf_username
      FROM type::thing($id);
      `,
      { id: userId },
    );

    console.log('[CF Karma API] DB query result:', userQuery);

    const resultArr = userQuery[0] as Record<string, unknown>[];
    const userData = Array.isArray(resultArr) ? resultArr[0] : resultArr;

    console.log('[CF Karma API] User data:', userData);

    if (!userData || !(userData as Record<string, unknown>).cf_username) {
      console.log('[CF Karma API] CF username not found');
      return NextResponse.json(
        { ok: false, error: 'Codeforces аккаунт не привязан' },
        { status: 400 },
      );
    }

    const cfHandle = (userData as Record<string, string>).cf_username;
    console.log('[CF Karma API] CF Handle:', cfHandle);

    const existingKarma =
      (userData as Record<string, number>).codeforces_karma || 0;
    console.log('[CF Karma API] Existing Karma:', existingKarma);

    // Получаем информацию о пользователе
    let cfUser: CodeforcesUser | null = null;
    try {
      const userRes = await axios.get(
        `https://codeforces.com/api/user.info?handles=${cfHandle}`,
      );
      if (userRes.data.status === 'OK' && userRes.data.result?.length > 0) {
        cfUser = userRes.data.result[0] as CodeforcesUser;
      }
    } catch (e) {
      console.error('Error fetching CF user info:', e);
    }

    // Получаем все submission'ы пользователя
    let allSubmissions: CodeforcesSubmission[] = [];
    let offset = 0;
    const count = 10000;

    try {
      while (true) {
        const submissionsRes = await axios.get(
          `https://codeforces.com/api/user.status?handle=${cfHandle}&from=${offset + 1}&count=${count}`,
        );

        if (submissionsRes.data.status !== 'OK') {
          break;
        }

        const submissions: CodeforcesSubmission[] = submissionsRes.data.result;

        if (submissions.length === 0) {
          break;
        }

        // Фильтруем только решенные задачи
        const solvedSubmissions = submissions.filter((s) => s.verdict === 'OK');
        allSubmissions = [...allSubmissions, ...solvedSubmissions];

        if (submissions.length < count) {
          break;
        }

        offset += count;

        if (offset > 100000) {
          break;
        }
      }
    } catch (e) {
      console.error('Error fetching CF submissions:', e);
    }

    // Убираем дубликаты задач
    const uniqueProblems = new Map<string, CodeforcesSubmission>();
    allSubmissions.forEach((sub) => {
      const problemIndex = sub.problem?.index || sub.problemIndex;
      if (!problemIndex) return; // Пропускаем задачи без индекса

      const key =
        sub.contestId && problemIndex
          ? `${sub.contestId}-${problemIndex}`
          : problemIndex;
      if (!uniqueProblems.has(key)) {
        uniqueProblems.set(key, sub);
      }
    });

    const uniqueSubmissions = Array.from(uniqueProblems.values());

    // Получаем информацию о задачах (рейтинг и теги)
    const contestIds = [
      ...new Set(
        uniqueSubmissions.filter((s) => s.contestId).map((s) => s.contestId!),
      ),
    ];
    const problemRatings = new Map<string, number>();
    const problemTags = new Map<string, string[]>();

    // Получаем информацию о задачах из контестов (ограничение на количество запросов)
    for (const contestId of contestIds.slice(0, 50)) {
      try {
        const contestRes = await axios.get(
          `https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`,
        );

        if (
          contestRes.data.status === 'OK' &&
          contestRes.data.result?.problems
        ) {
          const problems = contestRes.data.result.problems;
          problems.forEach(
            (problem: { index: string; rating?: number; tags?: string[] }) => {
              const key = `${contestId}-${problem.index}`;
              if (problem.rating) {
                problemRatings.set(key, problem.rating);
              }
              if (problem.tags && Array.isArray(problem.tags)) {
                problemTags.set(key, problem.tags);
              }
            },
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        console.error(`Error fetching contest ${contestId}:`, e);
      }
    }

    // Рассчитываем карму
    const karmaResult = calculateKarma(
      uniqueSubmissions,
      problemRatings,
      problemTags,
    );

    // Считаем статистику по тегам
    const tagStatsMap = new Map<
      string,
      { count: number; averageRating: number; totalRating: number }
    >();
    uniqueSubmissions.forEach((sub) => {
      const problemIndex = sub.problem?.index || sub.problemIndex;
      const key =
        sub.contestId && problemIndex
          ? `${sub.contestId}-${problemIndex}`
          : problemIndex;
      const tags = problemTags.get(key) || [];
      const rating = problemRatings.get(key) || 0;

      tags.forEach((tag) => {
        const existing = tagStatsMap.get(tag) || {
          count: 0,
          averageRating: 0,
          totalRating: 0,
        };
        existing.count++;
        if (rating > 0) {
          existing.totalRating += rating;
          existing.averageRating = Math.round(
            existing.totalRating / existing.count,
          );
        }
        tagStatsMap.set(tag, existing);
      });
    });

    const tagStats = Array.from(tagStatsMap.entries())
      .map(([tag, data]) => ({
        tag,
        solvedCount: data.count,
        averageRating: data.averageRating,
      }))
      .sort((a, b) => b.solvedCount - a.solvedCount)
      .slice(0, 20); // Топ-20 тегов

    // Считаем распределение по сложности
    const difficultyDistribution = {
      easy: karmaResult.details.easyCount,
      medium: karmaResult.details.mediumCount,
      hard: karmaResult.details.hardCount,
    };

    return NextResponse.json({
      ok: true,
      data: {
        karma: karmaResult.totalKarma,
        karmaLevel: getKarmaLevel(karmaResult.totalKarma),
        karmaColor: getKarmaColor(karmaResult.totalKarma),
        breakdown: karmaResult.breakdown,
        details: karmaResult.details,
        difficultyDistribution,
        tagStats,
        cfUser,
        existingKarma,
      },
    });
  } catch (err: unknown) {
    console.error('API GET Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          'Ошибка сервера: ' +
          (err instanceof Error ? err.message : 'Неизвестная ошибка'),
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/codeforces/karma
 * Пересчитывает и обновляет карму пользователя в БД
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

    const db = await getDB();
    if (!db) throw new Error('Ошибка подключения к БД');

    const userId = session.user.id.toString();

    // Получаем верифицированный CF username
    const userQuery = await db.query(
      `
      SELECT
        id,
        (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces' AND is_verified = true LIMIT 1)[0] AS cf_username
      FROM type::thing($id);
      `,
      { id: userId },
    );

    const resultArr = userQuery[0] as Record<string, unknown>[];
    const userData = Array.isArray(resultArr) ? resultArr[0] : resultArr;

    if (!userData || !(userData as Record<string, unknown>).cf_username) {
      return NextResponse.json(
        { ok: false, error: 'Codeforces аккаунт не привязан' },
        { status: 400 },
      );
    }

    const cfHandle = (userData as Record<string, string>).cf_username;

    // Получаем все submission'ы пользователя
    let allSubmissions: CodeforcesSubmission[] = [];
    let offset = 0;
    const count = 10000;

    try {
      while (true) {
        const submissionsRes = await axios.get(
          `https://codeforces.com/api/user.status?handle=${cfHandle}&from=${offset + 1}&count=${count}`,
        );

        if (submissionsRes.data.status !== 'OK') {
          break;
        }

        const submissions: CodeforcesSubmission[] = submissionsRes.data.result;

        if (submissions.length === 0) {
          break;
        }

        const solvedSubmissions = submissions.filter((s) => s.verdict === 'OK');
        allSubmissions = [...allSubmissions, ...solvedSubmissions];

        if (submissions.length < count) {
          break;
        }

        offset += count;

        if (offset > 100000) {
          break;
        }
      }
    } catch (e) {
      console.error('Error fetching CF submissions:', e);
    }

    // Убираем дубликаты задач
    const uniqueProblems = new Map<string, CodeforcesSubmission>();
    allSubmissions.forEach((sub) => {
      const problemIndex = sub.problem?.index || sub.problemIndex;
      if (!problemIndex) return; // Пропускаем задачи без индекса

      const key =
        sub.contestId && problemIndex
          ? `${sub.contestId}-${problemIndex}`
          : problemIndex;
      if (!uniqueProblems.has(key)) {
        uniqueProblems.set(key, sub);
      }
    });

    const uniqueSubmissions = Array.from(uniqueProblems.values());

    // Получаем информацию о задачах (рейтинг и теги)
    const contestIds = [
      ...new Set(
        uniqueSubmissions.filter((s) => s.contestId).map((s) => s.contestId!),
      ),
    ];
    const problemRatings = new Map<string, number>();
    const problemTags = new Map<string, string[]>();

    for (const contestId of contestIds.slice(0, 50)) {
      try {
        const contestRes = await axios.get(
          `https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`,
        );

        if (
          contestRes.data.status === 'OK' &&
          contestRes.data.result?.problems
        ) {
          const problems = contestRes.data.result.problems;
          problems.forEach(
            (problem: { index: string; rating?: number; tags?: string[] }) => {
              const key = `${contestId}-${problem.index}`;
              if (problem.rating) {
                problemRatings.set(key, problem.rating);
              }
              if (problem.tags && Array.isArray(problem.tags)) {
                problemTags.set(key, problem.tags);
              }
            },
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        console.error(`Error fetching contest ${contestId}:`, e);
      }
    }

    // Рассчитываем карму
    const karmaResult = calculateKarma(
      uniqueSubmissions,
      problemRatings,
      problemTags,
    );
    const newKarma = karmaResult.totalKarma;

    // Обновляем карму в БД
    await db.query(`UPDATE type::thing($id) SET codeforces_karma = $karma`, {
      id: userId,
      karma: newKarma,
    });

    return NextResponse.json({
      ok: true,
      data: {
        karma: newKarma,
        karmaLevel: getKarmaLevel(newKarma),
        karmaColor: getKarmaColor(newKarma),
        details: karmaResult.details,
      },
      message: 'Карма успешно обновлена',
    });
  } catch (err: unknown) {
    console.error('API POST Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          'Ошибка сервера: ' +
          (err instanceof Error ? err.message : 'Неизвестная ошибка'),
      },
      { status: 500 },
    );
  }
}
