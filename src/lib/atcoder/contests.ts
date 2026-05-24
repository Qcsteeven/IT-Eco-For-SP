import {
  fetchUpcomingContests,
  type Contest as AtCoderContest,
} from '@qatadaazzeh/atcoder-api';

export type NormalizedAtCoderContest = {
  id: string;
  title: string;
  name: string;
  platform: 'AtCoder';
  platform_contest_id: string;
  registration_link: string;
  external_link: string;
  start_time_utc: string;
  end_time_utc: string;
  status: 'Open' | 'Soon' | 'Finished';
  contestType: string;
  durationSeconds: number;
  startTimeSeconds: number;
  description: string;
};

type AtCoderContestQuery = {
  from?: Date;
  to?: Date;
};

function parseDurationSeconds(value: string) {
  const parts = value.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return 0;

  if (parts.length === 2) {
    const [hours, minutes] = parts;
    return hours * 60 * 60 + minutes * 60;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 60 * 60 + minutes * 60 + seconds;
  }

  return 0;
}

function resolveStatus(startMs: number, endMs: number) {
  const now = Date.now();
  if (Number.isFinite(endMs) && now > endMs) return 'Finished';
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && now >= startMs) {
    return 'Open';
  }

  return 'Soon';
}

function normalizeAtCoderContest(
  contest: AtCoderContest,
): NormalizedAtCoderContest | null {
  const start = new Date(contest.contestTime);
  const startMs = start.getTime();
  if (!Number.isFinite(startMs) || !contest.contestId) return null;

  const durationSeconds = parseDurationSeconds(contest.contestDuration);
  const endMs = startMs + durationSeconds * 1000;
  const end = new Date(Number.isFinite(endMs) ? endMs : startMs);
  const title = contest.contestName || contest.contestId;
  const contestType = contest.contestType || 'AtCoder';
  const contestUrl =
    contest.contestUrl || `https://atcoder.jp/contests/${contest.contestId}`;

  return {
    id: `atcoder:${contest.contestId}`,
    title,
    name: title,
    platform: 'AtCoder',
    platform_contest_id: contest.contestId,
    registration_link: contestUrl,
    external_link: contestUrl,
    start_time_utc: start.toISOString(),
    end_time_utc: end.toISOString(),
    status: resolveStatus(startMs, end.getTime()),
    contestType,
    durationSeconds,
    startTimeSeconds: Math.floor(startMs / 1000),
    description: `${contestType}${contest.isRated ? ', rated' : ', unrated'}`,
  };
}

function overlapsRange(
  contest: NormalizedAtCoderContest,
  from?: Date,
  to?: Date,
) {
  const start = new Date(contest.start_time_utc).getTime();
  const end = new Date(contest.end_time_utc).getTime();

  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    (!from || end >= from.getTime()) &&
    (!to || start <= to.getTime())
  );
}

export async function fetchNormalizedAtCoderContests(
  query: AtCoderContestQuery = {},
) {
  const contests = await fetchUpcomingContests();

  return contests
    .map(normalizeAtCoderContest)
    .filter((contest): contest is NormalizedAtCoderContest => Boolean(contest))
    .filter((contest) => overlapsRange(contest, query.from, query.to))
    .sort(
      (a, b) =>
        new Date(a.start_time_utc).getTime() -
        new Date(b.start_time_utc).getTime(),
    );
}
