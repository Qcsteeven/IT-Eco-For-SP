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
 * GET /api/codeforces/karma-fast
 * Быстрый расчет кармы без детальной информации о задачах
 * Использует только количество решенных задач по сложности из submission'ов
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
    console.log('[CF Karma Fast] Handle:', cfHandle);

    // Получаем все submission'ы пользователя (максимум 5000 за 1 запрос)
    // Лимит Codeforces API: 1 запрос в 2 секунды
    let allSubmissions: CodeforcesSubmission[] = [];

    try {
      console.log('[CF Karma Fast] Fetching submissions...');
      const submissionsRes = await axios.get(
        `https://codeforces.com/api/user.status?handle=${cfHandle}&from=1&count=5000`,
        { timeout: 10000 }, // Таймаут 10 секунд
      );

      if (submissionsRes.data.status === 'OK') {
        const submissions: CodeforcesSubmission[] = submissionsRes.data.result;
        console.log(
          '[CF Karma Fast] Total submissions received:',
          submissions.length,
        );

        // Фильтруем только решенные задачи (verdict === 'OK')
        allSubmissions = submissions.filter((s) => s.verdict === 'OK');
        console.log(
          '[CF Karma Fast] Solved submissions:',
          allSubmissions.length,
        );
      } else {
        console.error('[CF Karma Fast] API Error:', submissionsRes.data);
      }
    } catch (e) {
      console.error('[CF Karma Fast] Error fetching submissions:', e);
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

    console.log('[CF Karma Fast] Processing submissions...');
    let skippedCount = 0;

    // Проходим с конца, чтобы сохранить самые свежие submission'ы
    for (let i = allSubmissions.length - 1; i >= 0; i--) {
      const sub = allSubmissions[i];

      // Получаем problemIndex из problem.index или problemIndex
      const problemIndex = sub.problem?.index || sub.problemIndex;

      // Логируем первые несколько submission'ов для отладки
      if (i === allSubmissions.length - 1) {
        console.log('[CF Karma Fast] Sample submission:', {
          id: sub.id,
          contestId: sub.contestId,
          problemIndex: problemIndex,
          problem: sub.problem,
          verdict: sub.verdict,
          creationTimeSeconds: sub.creationTimeSeconds,
        });
      }

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
      '[CF Karma Fast] Unique problems solved:',
      uniqueSubmissions.length,
      '| Skipped:',
      skippedCount,
    );

    // Оцениваем сложность по индексу задачи
    // A, A1, A2... = easy (1 балл)
    // B, C = medium (3 балла)
    // D, E, F, G, H... = hard (10 баллов)
    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;

    uniqueSubmissions.forEach((sub) => {
      const problemIndex = sub.problem?.index || sub.problemIndex;
      if (!problemIndex) return;

      // A, A1, A2 и т.д. - легкие
      if (problemIndex.startsWith('A')) {
        easyCount++;
      }
      // B, C - средние
      else if (problemIndex.startsWith('B') || problemIndex.startsWith('C')) {
        mediumCount++;
      }
      // D, E, F, G, H и т.д. - сложные
      else {
        hardCount++;
      }
    });

    console.log('[CF Karma Fast] Difficulty breakdown:', {
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount,
    });

    // Рассчитываем карму
    const totalKarma = calculateSimpleKarma(easyCount, mediumCount, hardCount);
    console.log('[CF Karma Fast] Total karma:', totalKarma);

    // Считаем распределение по сложности
    const difficultyDistribution = {
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount,
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
          averageRating: 0,
          uniqueTags: 0,
        },
        difficultyDistribution,
        tagStats: [],
      },
      fast: true, // Флаг, что это быстрый расчет
    });
  } catch (err: unknown) {
    console.error('[CF Karma Fast] API Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Неизвестная ошибка',
      },
      { status: 500 },
    );
  }
}
