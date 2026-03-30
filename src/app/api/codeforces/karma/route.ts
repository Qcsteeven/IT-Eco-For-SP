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
import type { CodeforcesSubmission } from '@/types/codeforces';

/**
 * GET /api/codeforces/karma
 * Быстрый расчет кармы + список всех задач
 *
 * Логика фильтрации:
 * - Извлекаем только решения где verdict === 'OK'
 * - Решенной задачей считается уникальная комбинация contestId + index
 * - Игнорируем повторные решения одной задачи
 *
 * Производительность:
 * - Используем 1 запрос к API (лимит Codeforces: 1 запрос в 2 секунды)
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

    // Получаем верифицированный CF username
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

    const resultArr = userQuery[0] as Record<string, unknown>[];
    const userData = Array.isArray(resultArr) ? resultArr[0] : resultArr;

    if (!userData || !(userData as Record<string, unknown>).cf_username) {
      return NextResponse.json(
        { ok: false, error: 'Codeforces аккаунт не привязан' },
        { status: 400 },
      );
    }

    const cfHandle = (userData as Record<string, string>).cf_username;
    console.log('[CF Karma] Handle:', cfHandle);

    // Получаем все submission'ы пользователя (максимум 5000 за 1 запрос)
    // Лимит Codeforces API: 1 запрос в 2 секунды
    let allSubmissions: CodeforcesSubmission[] = [];

    try {
      console.log('[CF Karma] Fetching submissions...');
      const submissionsRes = await axios.get(
        `https://codeforces.com/api/user.status?handle=${cfHandle}&from=1&count=5000`,
        { timeout: 10000 }, // Таймаут 10 секунд
      );

      if (submissionsRes.data.status === 'OK') {
        const submissions: CodeforcesSubmission[] = submissionsRes.data.result;
        console.log(
          '[CF Karma] Total submissions received:',
          submissions.length,
        );

        // Фильтруем только решенные задачи (verdict === 'OK')
        allSubmissions = submissions.filter((s) => s.verdict === 'OK');
        console.log('[CF Karma] Solved submissions:', allSubmissions.length);
      } else {
        console.error('[CF Karma] API Error:', submissionsRes.data);
      }
    } catch (e) {
      console.error('[CF Karma] Error fetching submissions:', e);
      return NextResponse.json(
        {
          ok: false,
          error: 'Ошибка при получении данных с Codeforces. Попробуйте позже.',
        },
        { status: 500 },
      );
    }

    // Убираем дубликаты задач
    // Решенной задачей считается уникальная комбинация contestId + index
    const uniqueProblems = new Map<string, CodeforcesSubmission>();

    console.log('[CF Karma] Processing submissions...');
    let skippedCount = 0;

    // Проходим с конца, чтобы сохранить самые свежие submission'ы
    for (let i = allSubmissions.length - 1; i >= 0; i--) {
      const sub = allSubmissions[i];

      // Получаем problemIndex из problem.index или problemIndex
      const problemIndex = sub.problem?.index || sub.problemIndex;

      // Пропускаем задачи без contestId или problemIndex
      if (!sub.contestId || !problemIndex) {
        skippedCount++;
        continue;
      }

      // Уникальный ключ: contestId + problemIndex
      const key = `${sub.contestId}-${problemIndex}`;

      // Сохраняем только первое вхождение (самое свежее решение)
      if (!uniqueProblems.has(key)) {
        uniqueProblems.set(key, sub);
      }
    }

    const uniqueSubmissions = Array.from(uniqueProblems.values());
    console.log(
      '[CF Karma] Unique problems solved:',
      uniqueSubmissions.length,
      '| Skipped:',
      skippedCount,
    );

    // Оцениваем сложность по рейтингу ИЛИ индексу задачи
    // Если рейтинг < 1200 = easy (1 балл)
    // Если рейтинг 1200-1999 = medium (3 балла)
    // Если рейтинг ≥ 2000 = hard (10 баллов)
    // Если рейтинга нет = unknown
    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;
    let unknownCount = 0; // Задачи без рейтинга

    // Список задач для модального окна с полной информацией
    const problemsList: Array<{
      contestId: number;
      problemIndex: string;
      problemName?: string;
      solvedAt: number; // timestamp
      difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
      karma: number;
      tags?: string[];
      rating?: number;
    }> = [];

    uniqueSubmissions.forEach((sub) => {
      const problemIndex = sub.problem?.index || sub.problemIndex;
      const problemRating = sub.problem?.rating;
      if (!problemIndex) return;

      // Определяем сложность и карму
      // Если есть рейтинг - используем его (точно), иначе - unknown
      let difficulty: 'easy' | 'medium' | 'hard' | 'unknown' = 'unknown';
      let karma = 1;

      if (problemRating) {
        // Если есть рейтинг задачи, используем его (точно)
        if (problemRating < 1200) {
          easyCount++;
          difficulty = 'easy';
          karma = 1;
        } else if (problemRating < 2000) {
          mediumCount++;
          difficulty = 'medium';
          karma = 3;
        } else {
          hardCount++;
          difficulty = 'hard';
          karma = 10;
        }
      } else {
        // Если рейтинга нет - unknown
        unknownCount++;
        difficulty = 'unknown';
        // Карму считаем приблизительно по индексу
        if (problemIndex.startsWith('A')) {
          karma = 1;
        } else if (
          problemIndex.startsWith('B') ||
          problemIndex.startsWith('C')
        ) {
          karma = 3;
        } else {
          karma = 10;
        }
      }

      // Добавляем задачу в список с полной информацией
      problemsList.push({
        contestId: sub.contestId!,
        problemIndex: problemIndex,
        problemName:
          sub.problem?.name || sub.problemName || `Задача ${problemIndex}`,
        solvedAt: sub.creationTimeSeconds,
        difficulty,
        karma,
        tags: sub.problem?.tags || [],
        rating: problemRating,
      });
    });

    // Сортируем задачи по дате решения (новые сверху)
    problemsList.sort((a, b) => b.solvedAt - a.solvedAt);

    console.log('[CF Karma] Difficulty breakdown:', {
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount,
      unknown: unknownCount,
    });

    // Рассчитываем карму
    const totalKarma = calculateSimpleKarma(easyCount, mediumCount, hardCount);
    console.log('[CF Karma] Total karma:', totalKarma);

    // Считаем распределение по сложности
    const difficultyDistribution = {
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount,
      unknown: unknownCount,
    };

    return NextResponse.json({
      ok: true,
      data: {
        karma: totalKarma,
        karmaLevel: getKarmaLevel(totalKarma),
        karmaColor: getKarmaColor(totalKarma),
        breakdown: {
          easyKarma: easyCount * 1,
          mediumKarma: mediumCount * 3,
          hardKarma: hardCount * 10,
          tagBonusKarma: 0,
          diversityBonus: 0,
        },
        details: {
          totalSolved: uniqueSubmissions.length,
          easyCount,
          mediumCount,
          hardCount,
          unknownCount,
          averageRating: 0,
          uniqueTags: 0,
        },
        difficultyDistribution,
        tagStats: [],
        problems: problemsList, // Список всех задач для модального окна
      },
      fast: true, // Флаг, что это быстрый расчет
    });
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
