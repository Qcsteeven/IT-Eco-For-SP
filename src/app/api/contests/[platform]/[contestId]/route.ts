import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import axios from 'axios';

interface CFProblem {
  contestId: number;
  problemIndex: string;
  problemName: string;
  problemType: string;
  points?: number;
  rating?: number;
  tags: string[];
  solved: boolean;
  problemUrl?: string;
}

interface ContestProblemsResponse {
  ok: boolean;
  problems?: CFProblem[];
  solvedCount?: number;
  totalCount?: number;
  error?: string;
}

// GET - получение задач конкретного соревнования
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; contestId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    const { platform, contestId } = await params;

    console.log(`[API] Received platform: "${platform}", contestId: "${contestId}"`);

    // Нормализуем платформу к нижнему регистру
    const normalizedPlatform = platform?.toLowerCase();

    if (normalizedPlatform === 'codeforces') {
      return await getCFProblems(contestId, session.user.id.toString());
    } else if (normalizedPlatform === 'atcoder') {
      return await getAtCoderProblems(contestId, session.user.id.toString());
    } else {
      console.error(`[API] Unsupported platform: "${platform}"`);
      return NextResponse.json(
        { ok: false, error: 'Неподдерживаемая платформа' },
        { status: 400 },
      );
    }
  } catch (err: unknown) {
    console.error('Contest Problems API Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}

async function getCFProblems(
  contestId: string,
  userId: string
): Promise<NextResponse<ContestProblemsResponse>> {
  const db = await import('@/lib/surreal/surreal').then(m => m.getDB());
  if (!db) throw new Error('Ошибка подключения к БД');

  console.log(`[CF] getCFProblems called with contestId: "${contestId}", userId: "${userId}"`);

  // Получаем CF username пользователя
  const userQuery = await db.query(
    `SELECT (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces' AND is_verified = true LIMIT 1)[0] AS cf_username FROM type::thing($id)`,
    { id: userId },
  );

  console.log(`[CF] DB query result:`, JSON.stringify(userQuery));

  const resultArr = userQuery[0] as unknown[];
  const userData = Array.isArray(resultArr) ? resultArr[0] : resultArr;
  const cfHandle = (userData as { cf_username?: string })?.cf_username;

  console.log(`[CF] Extracted cfHandle: "${cfHandle}"`);

  if (!cfHandle) {
    console.error(`[CF] No Codeforces handle found for user`);
    return NextResponse.json(
      { ok: false, error: 'Аккаунт Codeforces не привязан' },
      { status: 400 },
    );
  }

  try {
    console.log(`[CF] Fetching problems from HTML: https://codeforces.com/contest/${contestId}/problems`);
    
    // Парсим HTML страницу с задачами
    const contestPageRes = await fetch(
      `https://codeforces.com/contest/${contestId}/problems`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }
    );
    
    console.log(`[CF] HTML response status:`, contestPageRes.status);
    
    let problems: CFProblem[] = [];
    const solvedProblemIndices = new Set<string>();
    
    if (contestPageRes.ok) {
      const html = await contestPageRes.text();
      console.log(`[CF] Fetched HTML, length: ${html.length}`);
      
      // Сохраняем HTML для отладки
      console.log(`[CF] HTML preview:`, html.substring(0, 3000));
      
      // Парсим задачи из HTML - ищем все строки таблицы задач
      // Каждая задача в <tr> с data-problem-id
      const tableRowRegex = /<tr[^>]*data-problem-id="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      
      while ((rowMatch = tableRowRegex.exec(html)) !== null) {
        const row = rowMatch[2];
        
        // Извлекаем индекс задачи (A, B, C...)
        const indexMatch = /<td\s+class="id"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/i.exec(row);
        
        if (indexMatch && indexMatch[1]) {
          const index = indexMatch[1].trim();
          
          // Извлекаем название задачи - оно в div class="title"
          const titleMatch = /<div\s+class="title"[^>]*>([^<]+)<\/div>/i.exec(row);
          let name = titleMatch ? titleMatch[1].trim() : `Problem ${index}`;
          
          // Убираем лишние пробелы и переносы строк
          name = name.replace(/\s+/g, ' ').trim();
          
          console.log(`[CF] Found problem: ${index} - ${name}`);
          
          problems.push({
            contestId: parseInt(contestId),
            problemIndex: index,
            problemName: name,
            problemType: 'PROGRAMMING',
            tags: [],
            solved: false,
            problemUrl: `https://codeforces.com/contest/${contestId}/problem/${index}`,
          });
        }
      }
      
      console.log(`[CF] Parsed ${problems.length} problems from HTML`);
    } else {
      console.warn(`[CF] Failed to fetch HTML, status: ${contestPageRes.status}`);
    }

    // Теперь получаем submission'ы пользователя, чтобы отметить решённые задачи
    console.log(`[CF] Fetching submissions for handle: ${cfHandle}`);
    
    try {
      const submissionsRes = await axios.get(
        `https://codeforces.com/api/user.status?handle=${cfHandle}&from=1&count=10000`,
        { 
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          }
        }
      );

      console.log(`[CF] Submissions response status:`, submissionsRes.data.status);

      if (submissionsRes.data.status === 'OK' && submissionsRes.data.result) {
        const submissions: unknown[] = submissionsRes.data.result;
        console.log(`[CF] Found ${submissions.length} total submissions`);

        // Отмечаем решённые задачи
        submissions.forEach((sub: unknown) => {
          const submission = sub as { 
            problem?: { contestId?: number; index?: string }; 
            verdict?: string;
          };
          
          if (submission.problem?.contestId === parseInt(contestId) && submission.verdict === 'OK') {
            solvedProblemIndices.add(submission.problem.index || '');
          }
        });
        
        console.log(`[CF] Solved problem indices:`, Array.from(solvedProblemIndices));
      }
    } catch (apiError: unknown) {
      console.warn(`[CF] Submissions API failed:`, (apiError as Error).message);
    }

    // Отмечаем решённые задачи
    problems = problems.map(p => ({
      ...p,
      solved: solvedProblemIndices.has(p.problemIndex),
    }));

    console.log(`[CF] Final problems count: ${problems.length}`);
    console.log(`[CF] Solved count: ${solvedProblemIndices.size}`);

    return NextResponse.json({
      ok: true,
      problems,
      solvedCount: problems.filter(p => p.solved).length,
      totalCount: problems.length,
    });
  } catch (apiError: unknown) {
    console.error('Codeforces API Error:', (apiError as Error)?.message);
    return NextResponse.json(
      { ok: false, error: 'Ошибка при получении данных Codeforces' },
      { status: 500 },
    );
  }
}

async function getAtCoderProblems(
  contestId: string,
  userId: string
): Promise<NextResponse<ContestProblemsResponse>> {
  const db = await import('@/lib/surreal/surreal').then(m => m.getDB());
  if (!db) throw new Error('Ошибка подключения к БД');

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

  try {
    // Используем AtCoder API для получения задач
    // AtCoder не имеет официального API для задач, поэтому используем парсинг
    const contestUrl = `https://atcoder.jp/contests/${contestId}/tasks`;
    
    const response = await fetch(contestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: 'Ошибка при получении задач AtCoder' },
        { status: 500 },
      );
    }

    const html = await response.text();
    
    // Парсим задачи из HTML
    const problems: CFProblem[] = [];
    const problemRegex = /<tr>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
    let match;
    
    while ((match = problemRegex.exec(html)) !== null) {
      const [, taskId, taskName] = match;
      problems.push({
        contestId: parseInt(contestId) || 0,
        problemIndex: taskId.trim(),
        problemName: taskName.trim(),
        problemType: 'PROGRAMMING',
        tags: [],
        solved: false, // Пока не можем определить без дополнительных запросов
      });
    }

    return NextResponse.json({
      ok: true,
      problems,
      solvedCount: 0,
      totalCount: problems.length,
    });
  } catch (apiError: unknown) {
    console.error('AtCoder API Error:', (apiError as Error)?.message);
    return NextResponse.json(
      { ok: false, error: 'Ошибка при получении данных AtCoder' },
      { status: 500 },
    );
  }
}
