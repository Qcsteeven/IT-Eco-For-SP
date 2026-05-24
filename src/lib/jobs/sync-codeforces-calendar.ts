import axios from 'axios';

import { buildContestEmbeddingText } from '@/lib/contembtext';
import { getEmbedding } from '@/lib/embedding';
import { getDB } from '@/lib/surreal/surreal';

type CfContest = {
  id: number;
  name: string;
  type: string;
  phase: string;
  frozen: boolean;
  durationSeconds: number;
  startTimeSeconds?: number;
};

type ContestDbRow = {
  title: string;
  name: string;
  platform: string;
  platform_contest_id: string;
  registration_link: string;
  start_time_utc: Date;
  end_time_utc: Date;
  status: 'Open' | 'Soon' | 'Finished';
  embedding: number[];
  updated_at: Date;
};

export type SyncCodeforcesCalendarResult =
  | {
      ok: true;
      scanned: number;
      synced: number;
      upserted: number;
      errors: string[];
      errorCount: number;
    }
  | { ok: false; error: string; status: number };

function cfPhaseToStatus(phase: string): 'Open' | 'Soon' | 'Finished' {
  if (phase === 'CODING') return 'Open';
  if (phase === 'FINISHED') return 'Finished';
  return 'Soon';
}

function listingStatusForEmbedding(phase: string): string {
  if (phase === 'FINISHED') return 'finished';
  if (phase === 'CODING') return 'running';
  return 'upcoming';
}

function shouldSyncContest(c: CfContest, nowSec: number): boolean {
  if (typeof c.startTimeSeconds !== 'number') return false;
  const start = c.startTimeSeconds;
  const duration = c.durationSeconds ?? 0;
  const end = start + duration;
  if (c.phase === 'BEFORE' || c.phase === 'CODING') return true;
  const horizonFuture = nowSec + 200 * 86400;
  const horizonPast = nowSec - 90 * 86400;
  return start < horizonFuture && end > horizonPast;
}

/**
 * Синхронизация списка контестов Codeforces в таблицу contests (эмбеддинги + upsert).
 * Не выполняет проверку CRON_SECRET — это делают route handlers.
 */
export async function syncCodeforcesCalendar(): Promise<SyncCodeforcesCalendarResult> {
  if (!process.env.ROUTERAI_API_KEY) {
    return {
      ok: false,
      error: 'ROUTERAI_API_KEY не задан — нужен для эмбеддингов contests',
      status: 500,
    };
  }

  try {
    const cfRes = await axios.get<{ status: string; result?: CfContest[] }>(
      'https://codeforces.com/api/contest.list',
    );

    if (cfRes.data.status !== 'OK' || !cfRes.data.result) {
      return {
        ok: false,
        error: 'Codeforces API: неверный ответ',
        status: 502,
      };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const toSync = cfRes.data.result.filter((c) =>
      shouldSyncContest(c, nowSec),
    );

    const db = await getDB();
    if (!db) {
      return { ok: false, error: 'Нет подключения к SurrealDB', status: 500 };
    }

    let upserted = 0;
    const errors: string[] = [];

    for (const c of toSync) {
      const startSec = c.startTimeSeconds!;
      const duration = c.durationSeconds ?? 0;
      const startAt = new Date(startSec * 1000);
      const endAt = new Date((startSec + duration) * 1000);
      const status = cfPhaseToStatus(c.phase);
      const platformContestId = String(c.id);
      const part = `codeforces_${c.id}`;
      const registrationLink = `https://codeforces.com/contest/${c.id}`;

      try {
        const embedText = await buildContestEmbeddingText({
          startTimeSeconds: startSec,
          durationSeconds: duration,
          type: c.type,
          name: c.name,
          platform: 'Codeforces',
          listingStatus: listingStatusForEmbedding(c.phase),
        });
        const embedding = await getEmbedding(embedText);

        const data: ContestDbRow = {
          title: c.name,
          name: c.name,
          platform: 'Codeforces',
          platform_contest_id: platformContestId,
          registration_link: registrationLink,
          start_time_utc: startAt,
          end_time_utc: endAt,
          status,
          embedding,
          updated_at: new Date(),
        };

        const updated = await db.query<unknown[]>(
          `UPDATE type::thing('contests', $part) CONTENT $data RETURN AFTER`,
          { part, data },
        );

        const first = updated[0];
        const touched = Array.isArray(first) && first.length > 0;

        if (!touched) {
          await db.query(
            `CREATE type::thing('contests', $part) CONTENT $data`,
            {
              part,
              data,
            },
          );
        }

        upserted += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${c.id}: ${msg}`);
        console.error(`[sync-codeforces-calendar] contest ${c.id}:`, e);
      }
    }

    return {
      ok: true,
      scanned: cfRes.data.result.length,
      synced: toSync.length,
      upserted,
      errors: errors.slice(0, 20),
      errorCount: errors.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sync-codeforces-calendar]', err);
    return { ok: false, error: message, status: 500 };
  }
}
