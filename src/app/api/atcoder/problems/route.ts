import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import axios from 'axios';
import {
  calculateSimpleKarma,
  getKarmaLevel,
  getKarmaColor,
} from '@/lib/codeforces/karma';

/**
 * Интерфейс для задачи AtCoder
 */
interface AtCoderProblem {
  contestId: string;
  contestName: string;
  taskIndex: string;
  taskName: string;
  solvedAt: number;
  difficulty?: number; // Рейтинг задачи
  karma: number;
}

/**
 * GET /api/atcoder/problems
 * Получает все решенные задачи пользователя с AtCoder и рассчитывает карму
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

    // Получаем верифицированный AtCoder username
    const userQuery = await db.query(
      `
      SELECT
        id,
        atcoder_karma,
        (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'atcoder' AND is_verified = true LIMIT 1)[0] AS atcoder_username
      FROM type::thing($id);
      `,
      { id: userId },
    );

    const resultArr = userQuery[0] as Record<string, unknown>[];
    const userData = Array.isArray(resultArr) ? resultArr[0] : resultArr;

    if (!userData || !(userData as Record<string, unknown>).atcoder_username) {
      return NextResponse.json(
        { ok: false, error: 'AtCoder аккаунт не привязан' },
        { status: 400 },
      );
    }

    const atcoderHandle = (userData as Record<string, string>).atcoder_username;
    console.log('[AtCoder Problems] Handle:', atcoderHandle);

    // Проверяем кэш кармы AtCoder (TTL 1 час)
    const CACHE_TTL = 60 * 60 * 1000;
    const now = Date.now();
    const atcoderAccountQuery = await db.query(
      `SELECT id, updated_at, cached_karma FROM external_accounts WHERE user_id = type::thing($user_id) AND platform_name = 'atcoder' AND is_verified = true LIMIT 1`,
      { user_id: userId },
    );
    const atcoderAccountArr = atcoderAccountQuery[0] as Record<
      string,
      unknown
    >[];
    const atcoderAccountData = atcoderAccountArr[0];

    const lastKarmaUpdate = atcoderAccountData?.updated_at
      ? new Date(atcoderAccountData.updated_at as string).getTime()
      : 0;
    const karmaCacheValid =
      lastKarmaUpdate && now - lastKarmaUpdate < CACHE_TTL;

    if (karmaCacheValid && atcoderAccountData?.cached_karma) {
      console.log('[AtCoder Problems] Using cached data');
      return NextResponse.json(
        JSON.parse(atcoderAccountData.cached_karma as string),
      );
    }

    console.log('[AtCoder Problems] Fetching from AtCoder API...');

    // Получаем все submission'ы пользователя с AtCoder
    // Используем неофициальное API или парсинг
    let allSubmissions: AtCoderProblem[] = [];

    try {
      // Получаем данные через Kenkoooo API (неофициальное AtCoder API)
      const submissionsRes = await axios.get(
        `https://kenkoooo.com/atcoder/atcoder-api/v2/user/submissions?user=${atcoderHandle}`,
      );

      if (submissionsRes.data && Array.isArray(submissionsRes.data)) {
        const submissions: Array<{
          contest_id: string;
          problem_index: string;
          problem_id: string;
          result: string;
          epoch_second: number;
          difficulty?: number;
        }> = submissionsRes.data;

        console.log(
          '[AtCoder Problems] Total submissions received:',
          submissions.length,
        );

        // Фильтруем только решенные задачи
        const solvedSubmissions = submissions.filter((s) => s.result === 'AC');
        console.log(
          '[AtCoder Problems] Solved submissions:',
          solvedSubmissions.length,
        );

        // Преобразуем в наш формат
        allSubmissions = solvedSubmissions.map((s) => ({
          contestId: s.contest_id,
          contestName: s.contest_id,
          taskIndex: s.problem_index,
          taskName: s.problem_id,
          solvedAt: s.epoch_second,
          difficulty: s.difficulty, // Рейтинг задачи (если есть)
          karma: 1, // Будет пересчитано ниже
        }));
      }
    } catch (e) {
      console.error('[AtCoder Problems] Error fetching submissions:', e);
      return NextResponse.json(
        {
          ok: false,
          error: 'Ошибка при получении данных с AtCoder. Попробуйте позже.',
        },
        { status: 500 },
      );
    }

    // Убираем дубликаты задач (оставляем первое решение)
    const uniqueProblems = new Map<string, AtCoderProblem>();

    console.log('[AtCoder Problems] Processing submissions...');

    // Проходим с конца, чтобы сохранить самые свежие submission'ы
    for (let i = allSubmissions.length - 1; i >= 0; i--) {
      const sub = allSubmissions[i];

      // Уникальный ключ: contestId + taskIndex
      const key = `${sub.contestId}-${sub.taskIndex}`;

      // Сохраняем только первое вхождение (самое свежее решение)
      if (!uniqueProblems.has(key)) {
        uniqueProblems.set(key, sub);
      }
    }

    const uniqueSubmissions = Array.from(uniqueProblems.values());
    console.log(
      '[AtCoder Problems] Unique problems solved:',
      uniqueSubmissions.length,
    );

    // Оцениваем сложность и карму
    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;
    let unknownCount = 0;

    uniqueSubmissions.forEach((problem) => {
      const difficulty = problem.difficulty;
      let karma = 1;
      let problemDifficulty: 'easy' | 'medium' | 'hard' | 'unknown' = 'unknown';

      if (difficulty) {
        // Если есть рейтинг задачи (в AtCoder это difficulty)
        if (difficulty < 400) {
          easyCount++;
          problemDifficulty = 'easy';
          karma = 1;
        } else if (difficulty < 1200) {
          mediumCount++;
          problemDifficulty = 'medium';
          karma = 3;
        } else {
          hardCount++;
          problemDifficulty = 'hard';
          karma = 10;
        }
      } else {
        // Если рейтинга нет - unknown (НЕ определяем по индексу!)
        unknownCount++;
        problemDifficulty = 'unknown';
        karma = 1; // Базовая карма без рейтинга
      }

      problem.karma = karma;
      (problem as { difficultyLevel: string }).difficultyLevel =
        problemDifficulty;
    });

    console.log('[AtCoder Problems] Difficulty breakdown:', {
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount,
      unknown: unknownCount,
    });

    // Сортируем задачи по дате решения (новые сверху)
    uniqueSubmissions.sort((a, b) => b.solvedAt - a.solvedAt);

    // Рассчитываем карму
    const totalKarma = calculateSimpleKarma(easyCount, mediumCount, hardCount);
    console.log('[AtCoder Problems] Total karma:', totalKarma);

    const response = {
      ok: true,
      data: {
        karma: totalKarma,
        karmaLevel: getKarmaLevel(totalKarma),
        karmaColor: getKarmaColor(totalKarma),
        details: {
          totalSolved: uniqueSubmissions.length,
          easyCount,
          mediumCount,
          hardCount,
          unknownCount,
        },
        problems: uniqueSubmissions,
      },
    };

    // Сохраняем в кэш
    if (atcoderAccountData?.id) {
      try {
        await db.query(
          `UPDATE type::thing($id) SET cached_karma = $karma, updated_at = time::now() WHERE platform_name = 'atcoder'`,
          {
            id: atcoderAccountData.id,
            karma: JSON.stringify(response),
          },
        );
        console.log('[AtCoder Problems] Cache saved');
      } catch (e) {
        console.error('[AtCoder Problems] Cache save error:', e);
      }
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error('[AtCoder Problems] API Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Неизвестная ошибка',
      },
      { status: 500 },
    );
  }
}
