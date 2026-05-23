import axios from 'axios';

import {
  getKarmaColor,
  getKarmaLevel,
  getTagMultiplier,
} from '@/lib/codeforces/karma';
import { getDB } from '@/lib/surreal/surreal';
import { parseUsersRecordKey, toUserThingId } from '@/lib/surreal/ids';
import type { CodeforcesSubmission } from '@/types/codeforces';

type DbRow = Record<string, unknown>;

export interface CodeforcesKarmaProblem {
  contestId: number;
  problemIndex: string;
  problemName?: string;
  solvedAt: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
  karma: number;
  tags?: string[];
  rating?: number;
}

export interface CodeforcesKarmaData {
  karma: number;
  loadedKarma: number;
  codeforcesKarma: number;
  manualAdjustment: number;
  karmaLevel: string;
  karmaColor: string;
  breakdown: {
    easyKarma: number;
    mediumKarma: number;
    hardKarma: number;
    unknownKarma: number;
    tagBonusKarma: number;
    diversityBonus: number;
  };
  details: {
    totalSolved: number;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
    unknownCount: number;
    averageRating: number;
    uniqueTags: number;
  };
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
    unknown: number;
  };
  tagStats: Array<{
    tag: string;
    solvedCount: number;
    averageRating: number;
  }>;
  problems: CodeforcesKarmaProblem[];
}

export interface CodeforcesKarmaResponse {
  ok: true;
  data: CodeforcesKarmaData;
  fast?: boolean;
  stale?: boolean;
  warning?: string;
}

export interface SyncCodeforcesKarmaResult {
  ok: boolean;
  scanned: number;
  synced: number;
  skipped: number;
  failed: number;
  errors: Array<{ userId: string; handle: string; error: string }>;
}

export function rowsFromQuery(result: unknown): DbRow[] {
  if (!Array.isArray(result)) return [];

  const first = result[0] as { result?: unknown } | unknown[] | undefined;
  if (Array.isArray(first)) {
    return first.filter(
      (row): row is DbRow => typeof row === 'object' && row !== null,
    );
  }

  if (first && typeof first === 'object' && Array.isArray(first.result)) {
    return first.result.filter(
      (row): row is DbRow => typeof row === 'object' && row !== null,
    );
  }

  return result.filter(
    (row): row is DbRow => typeof row === 'object' && row !== null,
  );
}

export function recordId(value: unknown): string {
  if (value == null) return '';

  if (typeof value === 'string') {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  if (typeof value === 'object') {
    const record = value as DbRow;
    if (typeof record.tb === 'string' && record.id != null) {
      return `${record.tb}:${String(record.id)}`;
    }
    if (record.id != null) return recordId(record.id);
  }

  return String(value);
}

export function toFiniteNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBaseKarma(rating: number | undefined) {
  if (!rating) return 1;
  if (rating < 1200) return 1;
  if (rating < 2000) return 3;
  return 10;
}

function getDifficulty(
  rating: number | undefined,
): CodeforcesKarmaProblem['difficulty'] {
  if (!rating) return 'unknown';
  if (rating < 1200) return 'easy';
  if (rating < 2000) return 'medium';
  return 'hard';
}

export async function getManualKarmaAdjustment(
  db: Awaited<ReturnType<typeof getDB>>,
  userId: string,
) {
  const userKey = parseUsersRecordKey(userId);
  const userThingId = toUserThingId(userKey);
  if (!userKey) return 0;

  const result = await db.query(
    `SELECT amount
     FROM karma_logs
     WHERE user = type::thing("users", $userKey)
        OR user = type::thing($userThingId)
        OR user = $userThingId`,
    { userKey, userThingId },
  );

  return rowsFromQuery(result).reduce(
    (sum, row) => sum + toFiniteNumber(row.amount),
    0,
  );
}

export function calculateCodeforcesKarmaData(
  submissions: CodeforcesSubmission[],
  manualAdjustment: number,
): CodeforcesKarmaData {
  const uniqueProblems = new Map<string, CodeforcesSubmission>();

  for (let i = submissions.length - 1; i >= 0; i--) {
    const sub = submissions[i];
    const problemIndex = sub.problem?.index || sub.problemIndex;
    if (!sub.contestId || !problemIndex || sub.verdict !== 'OK') continue;

    const key = `${sub.contestId}-${problemIndex}`;
    if (!uniqueProblems.has(key)) {
      uniqueProblems.set(key, sub);
    }
  }

  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;
  let unknownCount = 0;
  let easyKarma = 0;
  let mediumKarma = 0;
  let hardKarma = 0;
  let unknownKarma = 0;
  let totalRating = 0;
  let ratedCount = 0;
  const allTags = new Set<string>();
  const tagBuckets = new Map<
    string,
    { solvedCount: number; ratingSum: number }
  >();

  const problems = Array.from(uniqueProblems.values()).map((sub) => {
    const problemIndex = sub.problem?.index || sub.problemIndex || '';
    const rating = sub.problem?.rating;
    const tags = sub.problem?.tags || [];
    const difficulty = getDifficulty(rating);
    const karma = Math.round(getBaseKarma(rating) * getTagMultiplier(tags));

    switch (difficulty) {
      case 'easy':
        easyCount++;
        easyKarma += karma;
        break;
      case 'medium':
        mediumCount++;
        mediumKarma += karma;
        break;
      case 'hard':
        hardCount++;
        hardKarma += karma;
        break;
      case 'unknown':
        unknownCount++;
        unknownKarma += karma;
        break;
    }

    if (rating) {
      totalRating += rating;
      ratedCount++;
    }

    for (const tag of tags) {
      allTags.add(tag);
      const bucket = tagBuckets.get(tag) || { solvedCount: 0, ratingSum: 0 };
      bucket.solvedCount++;
      bucket.ratingSum += rating || 0;
      tagBuckets.set(tag, bucket);
    }

    return {
      contestId: sub.contestId!,
      problemIndex,
      problemName:
        sub.problem?.name || sub.problemName || `Задача ${problemIndex}`,
      solvedAt: sub.creationTimeSeconds,
      difficulty,
      karma,
      tags,
      rating,
    };
  });

  problems.sort((a, b) => b.solvedAt - a.solvedAt);

  const loadedKarma = easyKarma + mediumKarma + hardKarma + unknownKarma;
  const finalKarma = loadedKarma + manualAdjustment;
  const tagStats = Array.from(tagBuckets.entries())
    .map(([tag, stats]) => ({
      tag,
      solvedCount: stats.solvedCount,
      averageRating:
        stats.solvedCount > 0
          ? Math.round(stats.ratingSum / stats.solvedCount)
          : 0,
    }))
    .sort((a, b) => b.solvedCount - a.solvedCount);

  return {
    karma: finalKarma,
    loadedKarma,
    codeforcesKarma: loadedKarma,
    manualAdjustment,
    karmaLevel: getKarmaLevel(finalKarma),
    karmaColor: getKarmaColor(finalKarma),
    breakdown: {
      easyKarma,
      mediumKarma,
      hardKarma,
      unknownKarma,
      tagBonusKarma: 0,
      diversityBonus: 0,
    },
    details: {
      totalSolved: problems.length,
      easyCount,
      mediumCount,
      hardCount,
      unknownCount,
      averageRating: ratedCount > 0 ? Math.round(totalRating / ratedCount) : 0,
      uniqueTags: allTags.size,
    },
    difficultyDistribution: {
      easy: easyCount,
      medium: mediumCount,
      hard: hardCount,
      unknown: unknownCount,
    },
    tagStats,
    problems,
  };
}

export async function fetchCodeforcesKarmaData(
  handle: string,
  manualAdjustment: number,
  timeout = 20000,
) {
  const submissionsRes = await axios.get(
    `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=5000`,
    { timeout },
  );

  if (submissionsRes.data.status !== 'OK') {
    throw new Error('Codeforces вернул ошибку при загрузке submissions');
  }

  return calculateCodeforcesKarmaData(
    submissionsRes.data.result as CodeforcesSubmission[],
    manualAdjustment,
  );
}

export function buildCodeforcesKarmaResponse(
  data: CodeforcesKarmaData,
  options: { stale?: boolean; warning?: string } = {},
): CodeforcesKarmaResponse {
  return {
    ok: true,
    data,
    fast: true,
    ...options,
  };
}

export function combineCachedKarmaWithManualAdjustment(
  cachedKarma: unknown,
  manualAdjustment: number,
): CodeforcesKarmaResponse | null {
  try {
    const cached =
      typeof cachedKarma === 'string' ? JSON.parse(cachedKarma) : cachedKarma;
    const cachedData = (cached as { data?: Partial<CodeforcesKarmaData> })?.data;
    if (!cachedData) return null;

    const legacyCachedData = cachedData as Partial<CodeforcesKarmaData> & {
      storedKarma?: unknown;
    };
    const previousManual = toFiniteNumber(
      cachedData.manualAdjustment ?? legacyCachedData.storedKarma,
    );
    const loadedKarma =
      cachedData.loadedKarma !== undefined
        ? toFiniteNumber(cachedData.loadedKarma)
        : toFiniteNumber(cachedData.karma) - previousManual;
    const finalKarma = loadedKarma + manualAdjustment;
    const data: CodeforcesKarmaData = {
      karma: finalKarma,
      loadedKarma,
      codeforcesKarma: loadedKarma,
      manualAdjustment,
      karmaLevel: getKarmaLevel(finalKarma),
      karmaColor: getKarmaColor(finalKarma),
      breakdown: {
        easyKarma: toFiniteNumber(cachedData.breakdown?.easyKarma),
        mediumKarma: toFiniteNumber(cachedData.breakdown?.mediumKarma),
        hardKarma: toFiniteNumber(cachedData.breakdown?.hardKarma),
        unknownKarma: toFiniteNumber(cachedData.breakdown?.unknownKarma),
        tagBonusKarma: toFiniteNumber(cachedData.breakdown?.tagBonusKarma),
        diversityBonus: toFiniteNumber(cachedData.breakdown?.diversityBonus),
      },
      details: {
        totalSolved: toFiniteNumber(cachedData.details?.totalSolved),
        easyCount: toFiniteNumber(cachedData.details?.easyCount),
        mediumCount: toFiniteNumber(cachedData.details?.mediumCount),
        hardCount: toFiniteNumber(cachedData.details?.hardCount),
        unknownCount: toFiniteNumber(cachedData.details?.unknownCount),
        averageRating: toFiniteNumber(cachedData.details?.averageRating),
        uniqueTags: toFiniteNumber(cachedData.details?.uniqueTags),
      },
      difficultyDistribution: {
        easy: toFiniteNumber(cachedData.difficultyDistribution?.easy),
        medium: toFiniteNumber(cachedData.difficultyDistribution?.medium),
        hard: toFiniteNumber(cachedData.difficultyDistribution?.hard),
        unknown: toFiniteNumber(cachedData.difficultyDistribution?.unknown),
      },
      tagStats: Array.isArray(cachedData.tagStats)
        ? cachedData.tagStats
        : [],
      problems: Array.isArray(cachedData.problems)
        ? cachedData.problems
        : [],
    };

    return buildCodeforcesKarmaResponse(data);
  } catch {
    return null;
  }
}

export function storedOnlyKarmaResponse(
  loadedKarma: number,
  manualAdjustment: number,
  warning?: string,
) {
  const data = calculateCodeforcesKarmaData([], manualAdjustment);
  const finalKarma = loadedKarma + manualAdjustment;

  data.karma = finalKarma;
  data.loadedKarma = loadedKarma;
  data.codeforcesKarma = loadedKarma;
  data.karmaLevel = getKarmaLevel(finalKarma);
  data.karmaColor = getKarmaColor(finalKarma);

  return buildCodeforcesKarmaResponse(
    data,
    { stale: true, warning },
  );
}

export async function updateUserKarmaFields(
  db: Awaited<ReturnType<typeof getDB>>,
  userId: string,
  data: CodeforcesKarmaData,
) {
  const userKey = parseUsersRecordKey(userId);
  if (!userKey) return;

  await db.query(
    `UPDATE type::thing("users", $id)
     SET codeforces_karma = $codeforcesKarma`,
    {
      id: userKey,
      codeforcesKarma: data.loadedKarma,
    },
  );
}

export async function getStoredCodeforcesTaskKarma(
  db: Awaited<ReturnType<typeof getDB>>,
  userId: string,
) {
  const userKey = parseUsersRecordKey(userId);
  if (!userKey) return 0;

  const result = await db.query(
    `SELECT codeforces_karma
     FROM type::thing("users", $userKey)`,
    { userKey },
  );
  const row = rowsFromQuery(result)[0];
  return toFiniteNumber(row?.codeforces_karma);
}

export async function syncCodeforcesKarmaForUser({
  db,
  userId,
  accountId,
  handle,
  cachedKarma,
  timeout,
}: {
  db: Awaited<ReturnType<typeof getDB>>;
  userId: string;
  accountId?: string;
  handle: string;
  cachedKarma?: unknown;
  timeout?: number;
}) {
  const manualAdjustment = await getManualKarmaAdjustment(db, userId);

  try {
    const data = await fetchCodeforcesKarmaData(
      handle,
      manualAdjustment,
      timeout,
    );
    const response = buildCodeforcesKarmaResponse(data);

    await updateUserKarmaFields(db, userId, data);

    if (accountId) {
      await db.query(
        `UPDATE type::thing($id)
         SET cached_karma = $karma,
             updated_at = time::now()`,
        { id: accountId, karma: JSON.stringify(response) },
      );
    }

    return response;
  } catch (error) {
    const cached = combineCachedKarmaWithManualAdjustment(
      cachedKarma,
      manualAdjustment,
    );
    if (cached) {
      const response = {
        ...cached,
        stale: true,
        warning:
          'Codeforces сейчас не ответил, показаны последние сохранённые данные',
      };
      await updateUserKarmaFields(db, userId, response.data);
      return response;
    }

    const response = storedOnlyKarmaResponse(
      await getStoredCodeforcesTaskKarma(db, userId),
      manualAdjustment,
      'Codeforces сейчас не ответил, показаны сохранённые значения из БД',
    );
    await updateUserKarmaFields(db, userId, response.data);
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      fallback: response,
    });
  }
}

export async function syncCodeforcesKarmaForAllUsers(
  options: { timeout?: number; delayMs?: number } = {},
): Promise<SyncCodeforcesKarmaResult> {
  const db = await getDB();
  const timeout = options.timeout ?? 20000;
  const delayMs =
    options.delayMs ?? Number(process.env.CODEFORCES_KARMA_DELAY_MS || 2200);

  const accounts = rowsFromQuery(
    await db.query(
      `SELECT id, user_id, handle_username, cached_karma
       FROM external_accounts
       WHERE platform_name = 'codeforces'
         AND is_verified = true
         AND handle_username != NONE
         AND handle_username != ''`,
    ),
  );

  const result: SyncCodeforcesKarmaResult = {
    ok: true,
    scanned: accounts.length,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (let index = 0; index < accounts.length; index++) {
    const account = accounts[index];
    const userId = recordId(account.user_id);
    const handle = String(account.handle_username || '').trim();
    const accountId = recordId(account.id);

    if (!userId || !handle) {
      result.skipped++;
      continue;
    }

    try {
      await syncCodeforcesKarmaForUser({
        db,
        userId,
        accountId,
        handle,
        cachedKarma: account.cached_karma,
        timeout,
      });
      result.synced++;
    } catch (error) {
      const fallback = (error as { fallback?: CodeforcesKarmaResponse })
        .fallback;
      if (fallback) {
        result.synced++;
      } else {
        result.failed++;
        result.ok = false;
      }

      result.errors.push({
        userId,
        handle,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (index < accounts.length - 1 && delayMs > 0) {
      await delay(delayMs);
    }
  }

  return result;
}
