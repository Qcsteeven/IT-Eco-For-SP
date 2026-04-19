import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import axios from 'axios';
import type {
  CodeforcesSubmission,
  CodeforcesUser,
  CodeforcesProblemStats,
  CodeforcesTagStats,
} from '@/types/codeforces';

/**
 * GET /api/codeforces/submissions
 * Получает все submission'ы пользователя с Codeforces и рассчитывает статистику
 */
export async function GET() {
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

    // Получаем верифицированный CF username пользователя
    const userQuery = await db.query(
      `
      SELECT
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

    // Получаем информацию о пользователе
    let cfUser: CodeforcesUser | null = null;
    try {
      const userRes = await axios.get(
        `https://codeforces.com/api/user.info?handles=${cfHandle}`,
      );
      if (userRes.data.status === 'OK' && userRes.data.result?.length > 0) {
        cfUser = userRes.data.result[0];
      }
    } catch (e) {
      console.error('Error fetching CF user info:', e);
    }

    // Получаем все submission'ы пользователя
    // Codeforces API возвращает submission'ы постранично, но мы можем получить все
    let allSubmissions: CodeforcesSubmission[] = [];
    let offset = 0;
    const count = 10000; // Максимальное количество за запрос

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

        // Фильтруем только решенные задачи (verdict === 'OK')
        const solvedSubmissions = submissions.filter((s) => s.verdict === 'OK');
        allSubmissions = [...allSubmissions, ...solvedSubmissions];

        // Если получили меньше чем запросили, значит это последняя страница
        if (submissions.length < count) {
          break;
        }

        offset += count;

        // Ограничение на количество итераций для предотвращения бесконечного цикла
        if (offset > 100000) {
          break;
        }
      }
    } catch (e) {
      console.error('Error fetching CF submissions:', e);
    }

    // Убираем дубликаты задач (одна задача может быть решена несколько раз)
    const uniqueProblems = new Map<string, CodeforcesSubmission>();
    allSubmissions.forEach((sub) => {
      const key = sub.contestId
        ? `${sub.contestId}-${sub.problemIndex}`
        : sub.problemIndex;
      if (!uniqueProblems.has(key)) {
        uniqueProblems.set(key, sub);
      }
    });

    const uniqueSubmissions = Array.from(uniqueProblems.values());

    // Получаем информацию о задачах (рейтинг и теги)
    // Для этого нужно получить информацию о каждом контесте
    const contestIds = [
      ...new Set(
        uniqueSubmissions.filter((s) => s.contestId).map((s) => s.contestId!),
      ),
    ];
    const problemRatings = new Map<string, number>();
    const problemTags = new Map<string, string[]>();

    // Получаем информацию о задачах из контестов
    for (const contestId of contestIds.slice(0, 50)) {
      // Ограничение на количество запросов
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

        // Небольшая задержка между запросами для соблюдения rate limit
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        console.error(`Error fetching contest ${contestId}:`, e);
      }
    }

    // Рассчитываем статистику
    const problemStats: CodeforcesProblemStats = {
      totalSolved: uniqueSubmissions.length,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0,
      averageRating: 0,
      maxRating: 0,
    };

    let totalRating = 0;
    let ratedProblemsCount = 0;

    uniqueSubmissions.forEach((sub) => {
      const problemIndex = sub.problem?.index || sub.problemIndex;
      const key =
        sub.contestId && problemIndex
          ? `${sub.contestId}-${problemIndex}`
          : problemIndex;
      const rating = problemRatings.get(key) || 0;

      if (rating > 0) {
        totalRating += rating;
        ratedProblemsCount++;

        if (rating < 1200) {
          problemStats.easySolved++;
        } else if (rating < 2000) {
          problemStats.mediumSolved++;
        } else {
          problemStats.hardSolved++;
        }

        if (rating > problemStats.maxRating) {
          problemStats.maxRating = rating;
        }
      }
    });

    if (ratedProblemsCount > 0) {
      problemStats.averageRating = Math.round(totalRating / ratedProblemsCount);
    }

    // Рассчитываем статистику по тегам
    const tagStatsMap = new Map<
      string,
      { count: number; totalRating: number }
    >();
    uniqueSubmissions.forEach((sub) => {
      const problemIndex = sub.problem?.index || sub.problemIndex;
      if (!problemIndex) return; // Пропускаем задачи без индекса

      const key =
        sub.contestId && problemIndex
          ? `${sub.contestId}-${problemIndex}`
          : problemIndex;
      const tags = problemTags.get(key) || [];
      const rating = problemRatings.get(key) || 0;

      tags.forEach((tag) => {
        const existing = tagStatsMap.get(tag) || { count: 0, totalRating: 0 };
        existing.count++;
        if (rating > 0) {
          existing.totalRating += rating;
        }
        tagStatsMap.set(tag, existing);
      });
    });

    const tagStats: CodeforcesTagStats[] = Array.from(tagStatsMap.entries())
      .map(([tag, data]) => ({
        tag,
        solvedCount: data.count,
        averageRating:
          data.totalRating > 0 ? Math.round(data.totalRating / data.count) : 0,
      }))
      .sort((a, b) => b.solvedCount - a.solvedCount);

    return NextResponse.json({
      ok: true,
      data: {
        user: cfUser,
        submissions: uniqueSubmissions,
        problemStats,
        tagStats,
        ratedProblemsCount,
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
