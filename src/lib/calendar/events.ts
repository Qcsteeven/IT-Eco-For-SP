import { getDB } from '@/lib/surreal/surreal';

export type CalendarEventSource = 'events' | 'contests';

export type CalendarEvent = {
  id: string;
  title: string;
  name: string;
  description?: string;
  platform: string;
  status: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link: string;
  external_link: string;
  visibility_type: 'public' | 'private';
  participant_list: string[];
  target_groups?: string[];
  created_by?: string;
  platform_contest_id?: string;
  source: CalendarEventSource;
};

type CalendarEventQuery = {
  from?: string | null;
  to?: string | null;
  includeContests?: boolean;
  includeEvents?: boolean;
};

type RawDbEvent = {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  description?: unknown;
  platform?: unknown;
  status?: unknown;
  start_time_utc?: unknown;
  end_time_utc?: unknown;
  registration_link?: unknown;
  external_link?: unknown;
  visibility_type?: unknown;
  participant_list?: unknown;
  target_groups?: unknown;
  created_by?: unknown;
  platform_contest_id?: unknown;
};

function rowsFromStatement(value: unknown): RawDbEvent[] {
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is RawDbEvent => typeof row === 'object' && row !== null,
    );
  }

  if (value && typeof value === 'object') {
    const result = (value as { result?: unknown }).result;
    if (Array.isArray(result)) {
      return result.filter(
        (row): row is RawDbEvent => typeof row === 'object' && row !== null,
      );
    }
  }

  return [];
}

const DEFAULT_LOOKAHEAD_DAYS = 120;
const DEFAULT_LOOKBEHIND_DAYS = 14;

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function recordId(value: unknown, fallback = '') {
  if (value == null) return fallback;

  if (typeof value === 'string') {
    const decoded = decodeURIComponent(value);
    return decoded || fallback;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tb === 'string' && record.id != null) {
      return `${record.tb}:${String(record.id)}`;
    }

    if (record.id != null) return recordId(record.id, fallback);
  }

  return String(value) || fallback;
}

function toIso(value: unknown) {
  const raw = text(value);
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseRangeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildRange(query: CalendarEventQuery) {
  const now = new Date();
  const from =
    parseRangeDate(query.from) ??
    new Date(now.getTime() - DEFAULT_LOOKBEHIND_DAYS * 24 * 60 * 60 * 1000);
  const to =
    parseRangeDate(query.to) ??
    new Date(now.getTime() + DEFAULT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  return { from, to };
}

function overlapsRange(startIso: string, endIso: string, from: Date, to: Date) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start <= to.getTime() &&
    end >= from.getTime()
  );
}

function resolveStatus(startIso: string, endIso: string, rawStatus?: string) {
  if (rawStatus && rawStatus !== 'undefined' && rawStatus !== 'null') {
    return rawStatus;
  }

  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();

  if (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    now >= start &&
    now <= end
  ) {
    return 'active';
  }

  if (Number.isFinite(end) && now > end) {
    return 'completed';
  }

  return 'upcoming';
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => recordId(item)).filter(Boolean)
    : [];
}

function normalizeDbEvent(
  record: RawDbEvent,
  source: 'events' | 'contests',
): CalendarEvent | null {
  const startIso = toIso(record.start_time_utc);
  const endIso = toIso(record.end_time_utc) ?? startIso;
  if (!startIso || !endIso) return null;

  const title = text(record.title || record.name, 'Событие');
  const platform = text(
    record.platform,
    source === 'contests' ? 'codeforces' : 'custom',
  ).toLowerCase();
  const link = text(record.registration_link || record.external_link);
  const platformContestId = text(record.platform_contest_id);

  return {
    id: recordId(
      record.id,
      `${source}:${platform}:${platformContestId || title}:${startIso}`,
    ),
    title,
    name: title,
    description: text(record.description),
    platform,
    status: resolveStatus(startIso, endIso, text(record.status)),
    start_time_utc: startIso,
    end_time_utc: endIso,
    registration_link: link,
    external_link: link,
    visibility_type:
      text(record.visibility_type) === 'private' ? 'private' : 'public',
    participant_list: toStringArray(record.participant_list),
    target_groups: toStringArray(record.target_groups),
    created_by: recordId(record.created_by),
    platform_contest_id: platformContestId || undefined,
    source,
  };
}

async function getDbCalendarEvents(
  from: Date,
  to: Date,
  options: Pick<CalendarEventQuery, 'includeContests' | 'includeEvents'>,
) {
  try {
    const db = await getDB();
    const queries: string[] = [];
    const rangeWhere =
      'WHERE start_time_utc <= type::datetime($to) AND end_time_utc >= type::datetime($from)';

    if (options.includeEvents !== false) {
      queries.push(
        `SELECT * FROM events ${rangeWhere} ORDER BY start_time_utc ASC`,
      );
    }

    if (options.includeContests !== false) {
      queries.push(
        `SELECT * FROM contests ${rangeWhere} ORDER BY start_time_utc ASC`,
      );
    }

    if (queries.length === 0) return [];

    const result = await db.query<unknown[]>(`${queries.join(';')};`, {
      from: from.toISOString(),
      to: to.toISOString(),
    });
    let index = 0;
    const events =
      options.includeEvents !== false ? rowsFromStatement(result[index++]) : [];
    const contests =
      options.includeContests !== false
        ? rowsFromStatement(result[index++])
        : [];

    return [
      ...events.map((event) => normalizeDbEvent(event, 'events')),
      ...contests.map((contest) => normalizeDbEvent(contest, 'contests')),
    ].filter((event): event is CalendarEvent =>
      Boolean(
        event &&
        overlapsRange(event.start_time_utc, event.end_time_utc, from, to),
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[calendar] Database events are unavailable:', message);
    return [];
  }
}

function dedupeEvents(events: CalendarEvent[]) {
  const seen = new Set<string>();
  const result: CalendarEvent[] = [];

  for (const event of events) {
    const key =
      `${event.platform}:${event.platform_contest_id || event.title}:${event.start_time_utc}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
  }

  return result;
}

export async function listCalendarEvents(query: CalendarEventQuery = {}) {
  const { from, to } = buildRange(query);
  const dbEvents = await getDbCalendarEvents(from, to, query);

  return dedupeEvents(dbEvents).sort(
    (a, b) =>
      new Date(a.start_time_utc).getTime() -
      new Date(b.start_time_utc).getTime(),
  );
}
