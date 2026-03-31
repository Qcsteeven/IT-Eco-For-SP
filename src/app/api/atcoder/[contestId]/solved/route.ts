import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDB } from '@/lib/surreal/surreal';

interface SolvedProblem {
  problemIndex: string;
  problemName: string;
  problemUrl: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    const { contestId } = await params;
    const db = await getDB();
    if (!db) throw new Error('Ошибка подключения к БД');

    const userId = session.user.id.toString();

    // Получаем AtCoder username пользователя
    const userQuery = await db.query(
      `SELECT (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'atcoder' AND is_verified = true LIMIT 1)[0] AS atcoder_username FROM type::thing($id)`,
      { id: userId },
    );

    const resultArr = userQuery[0] as unknown[];
    const userData = Array.isArray(resultArr) ? resultArr[0] : resultArr;
    const atcoderUsername = (userData as { atcoder_username?: string })?.atcoder_username;

    if (!atcoderUsername) {
      return NextResponse.json(
        { ok: false, error: 'Аккаунт AtCoder не привязан' },
        { status: 400 },
      );
    }

    console.log(`[AtCoder API] Fetching solved problems for ${atcoderUsername} in contest ${contestId}`);

    // Используем AtCoder Problems API v3 (Kenkoooo)
    // Правильный формат: https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user={username}&from_second={timestamp}
    // from_second - UNIX timestamp в секундах
    const tenYearsAgo = Math.floor(Date.now() / 1000) - (10 * 365 * 24 * 60 * 60); // 10 лет назад
    
    const apiUrl = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(atcoderUsername)}&from_second=${tenYearsAgo}`;
    
    console.log(`[AtCoder API] Fetching: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    console.log(`[AtCoder API] Kenkoooo API status:`, response.status);

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: 'Ошибка при получении данных AtCoder Problems' },
        { status: 500 },
      );
    }

    const submissions = await response.json();
    console.log(`[AtCoder API] Fetched ${submissions.length} submissions`);
    
    return processSubmissions(submissions, contestId);
  } catch (err: unknown) {
    console.error('[AtCoder API] Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}

interface AtCoderSubmission {
  problem_id?: string;
  contest_id?: string;
  result?: string;
  [key: string]: unknown;
}

function processSubmissions(submissions: AtCoderSubmission[], contestId: string) {
  // Фильтруем submission'ы по контесту и статусу AC
  const solvedProblemIds = new Set<string>();

  submissions.forEach((sub) => {
    if (sub.problem_id && sub.contest_id === contestId && sub.result === 'AC') {
      solvedProblemIds.add(sub.problem_id);
    }
  });

  console.log(`[AtCoder API] Solved problem IDs in contest ${contestId}:`, Array.from(solvedProblemIds));

  return NextResponse.json({
    ok: true,
    problemIds: Array.from(solvedProblemIds),
    contestId: contestId,
  });
}

// Отдельный endpoint для получения названий задач
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const { contestId } = await params;
    const body = await req.json();
    const { problemIds } = body as { problemIds: string[] };

    console.log(`[AtCoder API] Fetching task names for contest ${contestId}, problems:`, problemIds);

    // Парсим HTML страницы задач для получения названий
    const tasksPageRes = await fetch(`https://atcoder.jp/contests/${contestId}/tasks`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const taskNames = new Map<string, string>();

    if (tasksPageRes.ok) {
      const html = await tasksPageRes.text();
      
      // Парсим все задачи из контеста
      // Формат: <a href="/contests/abc448/tasks/abc448_a">A - AtCoder Quiz 1</a>
      const taskRegex = /<a\s+href="\/contests\/[^"]+\/tasks\/([^"]+)">([^<]+)<\/a>/gi;
      let match;
      
      while ((match = taskRegex.exec(html)) !== null) {
        const [, taskId, taskName] = match;
        taskNames.set(taskId, taskName.trim());
      }
      
      console.log(`[AtCoder API] Parsed ${taskNames.size} task names`);
    }

    // Формируем список решённых задач с реальными названиями
    const solvedProblems: SolvedProblem[] = [];
    const seenIndices = new Set<string>();

    for (const problemId of problemIds) {
      // Извлекаем индекс задачи из problem_id (например, abc448_a -> A)
      const problemParts = problemId.split('_');
      const index = problemParts.length > 1 ? problemParts[problemParts.length - 1].toUpperCase() : problemId.toUpperCase();
      
      if (seenIndices.has(index)) continue;
      seenIndices.add(index);

      solvedProblems.push({
        problemIndex: index,
        problemName: taskNames.get(problemId) || problemId,
        problemUrl: `https://atcoder.jp/contests/${contestId}/tasks/${problemId}`,
      });
    }

    // Сортируем по индексу
    solvedProblems.sort((a, b) => a.problemIndex.localeCompare(b.problemIndex));

    console.log(`[AtCoder API] Final solved problems: ${solvedProblems.length}`);

    return NextResponse.json({
      ok: true,
      problems: solvedProblems,
      totalCount: solvedProblems.length,
    });
  } catch (err: unknown) {
    console.error('[AtCoder API] Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}
