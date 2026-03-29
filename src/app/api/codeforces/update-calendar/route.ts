import { NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import axios from 'axios';

interface CodeforcesContest {
  id: number;
  name: string;
  type: string;
  phase: string;
  frozen: boolean;
  durationSeconds: number;
  startTimeSeconds: number;
}

interface ParsedContest {
  // Основные поля (соответствуют схеме БД)
  name: string;           // DEFINE FIELD name ON contests TYPE string
  title: string;          // DEFINE FIELD title ON contests TYPE string
  platform: string;       // DEFINE FIELD platform ON contests TYPE string
  platform_contest_id: string;  // DEFINE FIELD platform_contest_id ON contests TYPE string
  status: 'Open' | 'Soon' | 'Finished';  // DEFINE FIELD status ON contests TYPE string DEFAULT 'Soon'
  start_time_utc: string; // DEFINE FIELD start_time_utc ON contests TYPE datetime
  end_time_utc: string;   // DEFINE FIELD end_time_utc ON contests TYPE datetime
  registration_link: string;  // DEFINE FIELD registration_link ON contests TYPE string
  
  // Дополнительные поля (для внутренней логики)
  type: string;           // Тип контеста (CF, ICPC)
  phase: string;          // Фаза (FINISHED, RUNNING, etc.)
  frozen: boolean;        // Заморожен ли
  duration_seconds: number;  // Длительность в секундах
  
  // Embedding генерируется отдельно
  embedding?: number[];   // DEFINE FIELD embedding ON contests TYPE array<float> ASSERT $value.len() = 1024
}

/**
 * Парсинг контестов с Codeforces API
 * https://codeforces.com/apiHelp/contest#list
 */
async function fetchCodeforcesContests(): Promise<ParsedContest[]> {
  try {
    const response = await axios.get('https://codeforces.com/api/contest.list');
    
    if (response.data.status !== 'OK') {
      throw new Error('Codeforces API returned non-OK status');
    }

    const contests: CodeforcesContest[] = response.data.result || [];
    
    // Фильтруем только предстоящие и текущие контесты (за последние 2 года и будущие)
    const now = Date.now() / 1000;
    const twoYearsAgo = now - (2 * 365 * 24 * 60 * 60);
    
    return contests
      .filter((contest) => {
        // Пропускаем тренировочные контесты и gym
        if (contest.type !== 'CF' && contest.type !== 'ICPC') {
          return false;
        }
        // Берём контесты за последние 2 года и будущие
        return contest.startTimeSeconds >= twoYearsAgo;
      })
      .map((contest) => {
        const startTime = new Date(contest.startTimeSeconds * 1000);
        const endTime = new Date(startTime.getTime() + contest.durationSeconds * 1000);

        // Определяем статус (соответствует схеме БД: 'Open', 'Soon', 'Finished')
        let status: 'Open' | 'Soon' | 'Finished' = 'Soon';
        if (contest.phase === 'FINISHED') {
          status = 'Finished';
        } else if (contest.phase === 'RUNNING' || contest.phase === 'CODING') {
          status = 'Open';
        }

        return {
          name: contest.name,        // Поле БД
          title: contest.name,       // Поле БД (копия name)
          platform: 'Codeforces',
          platform_contest_id: String(contest.id),
          status,
          start_time_utc: startTime.toISOString(),
          end_time_utc: endTime.toISOString(),
          registration_link: `https://codeforces.com/contest/${contest.id}`,
          type: contest.type,
          phase: contest.phase,
          frozen: contest.frozen === true,
          duration_seconds: contest.durationSeconds,
        };
      });
  } catch (error) {
    console.error('[Codeforces Fetch] Error:', error);
    throw error;
  }
}

/**
 * Генерация эмбеддинга для контеста
 */
async function generateContestEmbedding(contest: {
  title: string;
  platform: string;
  type?: string;
}): Promise<number[]> {
  try {
    // Создаём текстовое описание для эмбеддинга
    const text = `Codeforces programming contest ${contest.title} competitive coding championship round ${contest.type || ''}`;
    
    // Используем локальную функцию эмбеддинга
    const { getEmbedding } = await import('@/lib/embedding');
    const embedding = await getEmbedding(text);
    
    // Проверяем размер embedding (должен быть 1024)
    if (embedding.length !== 1024) {
      console.warn(`[Embedding] Expected 1024 dimensions, got ${embedding.length}. Padding...`);
      // Дополняем нулями до 1024
      while (embedding.length < 1024) {
        embedding.push(0);
      }
    }
    
    return embedding;
  } catch (error) {
    console.error('[Embedding] Error:', error);
    // Возвращаем пустой вектор размером 1024 (требуется схемой БД)
    return new Array(1024).fill(0);
  }
}

/**
 * Экранирование специальных символов в строках для SurrealDB
 */
function escapeString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

/**
 * Обновление календаря контестов в БД
 */
async function updateContestsInDB(contests: ParsedContest[]) {
  const db = await getDB();
  
  const results = {
    added: 0,
    updated: 0,
    total: contests.length,
  };

  type QueryResult = { id: string }[];

  for (const contest of contests) {
    try {
      // Проверяем, существует ли уже контест с таким platform_contest_id
      const existing = await db.query(
        `SELECT * FROM contests WHERE platform_contest_id = $id AND platform = 'Codeforces' LIMIT 1`,
        { id: contest.platform_contest_id }
      );

      const existingContest = (existing[0] as QueryResult[])?.[0];

      if (existingContest) {
        // Обновляем существующий контест
        // Даты вставляем напрямую через d"..." чтобы избежать проблем с типами
        const startTimeStr = escapeString(contest.start_time_utc);
        const endTimeStr = escapeString(contest.end_time_utc);
        const nameStr = escapeString(contest.title);  // title -> name для схемы БД

        await db.query(
          `UPDATE contests SET
            name = "${nameStr}",
            title = "${nameStr}",
            status = "${contest.status}",
            start_time_utc = d"${startTimeStr}",
            end_time_utc = d"${endTimeStr}",
            registration_link = "${escapeString(contest.registration_link)}",
            type = "${contest.type}",
            phase = "${contest.phase}",
            frozen = ${contest.frozen},
            duration_seconds = ${contest.duration_seconds},
            updated_at = time::now()
          WHERE platform_contest_id = "${contest.platform_contest_id}" AND platform = 'Codeforces'`
        );
        results.updated++;
      } else {
        // Создаём новый контест
        const embedding = await generateContestEmbedding(contest);

        // Даты вставляем напрямую через d"..."
        const startTimeStr = escapeString(contest.start_time_utc);
        const endTimeStr = escapeString(contest.end_time_utc);
        const nameStr = escapeString(contest.title);  // title -> name для схемы БД

        await db.query(
          `CREATE contests CONTENT {
            name: "${nameStr}",
            title: "${nameStr}",
            platform: "${contest.platform}",
            status: "${contest.status}",
            start_time_utc: d"${startTimeStr}",
            end_time_utc: d"${endTimeStr}",
            registration_link: "${escapeString(contest.registration_link)}",
            platform_contest_id: "${contest.platform_contest_id}",
            type: "${contest.type}",
            phase: "${contest.phase}",
            frozen: ${contest.frozen},
            duration_seconds: ${contest.duration_seconds},
            embedding: ${JSON.stringify(embedding)},
            created_at: time::now(),
            updated_at: time::now()
          }`
        );
        results.added++;
      }
    } catch (error) {
      console.error('[DB] Error processing contest:', contest.title, error);
    }
  }

  return results;
}

// GET endpoint для обновления календаря
export async function GET() {
  try {
    console.log('[Update Calendar] Starting update process...');
    
    // 1. Получаем контесты с Codeforces
    const contests = await fetchCodeforcesContests();
    console.log(`[Update Calendar] Fetched ${contests.length} contests from Codeforces`);
    
    // 2. Обновляем БД
    const results = await updateContestsInDB(contests);
    
    console.log('[Update Calendar] Completed:', results);
    
    return NextResponse.json({
      ok: true,
      message: 'Calendar updated successfully',
      data: results,
    });
  } catch (error) {
    console.error('[Update Calendar] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to update calendar',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
