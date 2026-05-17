import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDB } from '@/lib/surreal/surreal';
import { parseUsersRecordKey, toUserThingId } from '@/lib/surreal/ids';
import type { Event as CoachEvent } from '@/lib/types/event';

interface ContestRecord {
  id: unknown;
  title?: string;
  name?: string;
  platform?: string;
  status?: string;
  start_time_utc?: string;
  end_time_utc?: string;
  registration_link?: string;
  platform_contest_id?: string;
}

interface CalendarEvent {
  id: string;
  name: string;
  title: string;
  platform: string;
  status: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link: string;
  source: 'contest' | 'event';
}

function toRecordIdString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tb === 'string' && record.id != null) {
      return `${record.tb}:${String(record.id)}`;
    }
    if (typeof record.id === 'string') return record.id;
  }

  return String(value);
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(toRecordIdString).filter(Boolean);
}

function normalizeContest(contest: ContestRecord): CalendarEvent {
  const name = contest.name || contest.title || 'Untitled contest';

  return {
    id: toRecordIdString(contest.id),
    name,
    title: name,
    platform: contest.platform || 'contest',
    status: contest.status || 'upcoming',
    start_time_utc: String(contest.start_time_utc || ''),
    end_time_utc: String(contest.end_time_utc || ''),
    registration_link: contest.registration_link || '#',
    source: 'contest',
  };
}

function normalizeCoachEvent(event: CoachEvent): CalendarEvent {
  return {
    id: toRecordIdString((event as unknown as Record<string, unknown>).id),
    name: event.title,
    title: event.title,
    platform: event.platform || 'event',
    status: event.status || 'upcoming',
    start_time_utc: String(event.start_time_utc || ''),
    end_time_utc: String(event.end_time_utc || ''),
    registration_link: event.external_link || '#',
    source: 'event',
  };
}

function canSeeCoachEvent(
  event: CoachEvent,
  options: {
    role?: string;
    userId?: string;
    legacyUserId?: string;
    groupIds: Set<string>;
  },
): boolean {
  if (event.visibility_type === 'public') return true;
  if (options.role === 'admin') return true;
  if (!options.userId) return false;

  const record = event as unknown as Record<string, unknown>;
  const createdBy = toRecordIdString(record.created_by);
  if (createdBy === options.userId || createdBy === options.legacyUserId) {
    return true;
  }

  const participants = normalizeList(event.participant_list);
  if (
    participants.includes(options.userId) ||
    (options.legacyUserId && participants.includes(options.legacyUserId))
  ) {
    return true;
  }

  const targetGroups = normalizeList(event.target_groups);
  return targetGroups.some((groupId) => options.groupIds.has(groupId));
}

async function getCurrentUserGroupIds(
  db: Awaited<ReturnType<typeof getDB>>,
  userId: string,
): Promise<Set<string>> {
  const userKey = parseUsersRecordKey(userId);
  const userThingId = toUserThingId(userId);

  const result = await db.query<unknown[][]>(
    `
    SELECT VALUE group_id
    FROM group_members
    WHERE user_id = type::thing("users", $userKey)
      OR user_id = type::thing($userThingId);

    SELECT VALUE group_id
    FROM group_coaches
    WHERE coach_id = type::thing("users", $userKey)
      OR coach_id = type::thing($userThingId);
    `,
    { userKey, userThingId },
  );

  return new Set(
    [...(result[0] || []), ...(result[1] || [])]
      .map(toRecordIdString)
      .filter(Boolean),
  );
}

export async function GET() {
  try {
    const db = await getDB();
    const session = await getServerSession(authOptions);

    const [contestResult, eventResult] = await Promise.all([
      db.query<ContestRecord[][]>(
        'SELECT * FROM contests ORDER BY start_time_utc ASC;',
      ),
      db.query<CoachEvent[][]>(
        'SELECT * FROM events ORDER BY start_time_utc ASC;',
      ),
    ]);

    const userId = session?.user?.id?.toString();
    const userThingId = userId ? toUserThingId(userId) : undefined;
    const legacyUserId = userThingId ? `users:${userThingId}` : undefined;
    const groupIds = userId
      ? await getCurrentUserGroupIds(db, userId)
      : new Set<string>();

    const contests = (contestResult[0] || []).map(normalizeContest);
    const coachEvents = (eventResult[0] || [])
      .filter((event) =>
        canSeeCoachEvent(event, {
          role: session?.user?.role,
          userId: userThingId,
          legacyUserId,
          groupIds,
        }),
      )
      .map(normalizeCoachEvent);

    const calendarEvents = [...contests, ...coachEvents].sort((a, b) => {
      const aTime = new Date(a.start_time_utc).getTime();
      const bTime = new Date(b.start_time_utc).getTime();
      return aTime - bTime;
    });

    return NextResponse.json(calendarEvents);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API /contests/all] Error:', message);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 },
    );
  }
}
