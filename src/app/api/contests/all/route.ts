import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDB } from '@/lib/surreal/surreal';
import { listCalendarEvents, type CalendarEvent } from '@/lib/calendar/events';
import {
  parseUsersRecordKey,
  toGroupThingId,
  toUserThingId,
} from '@/lib/surreal/ids';

function recordId(value: unknown): string {
  if (value == null) return '';

  if (typeof value === 'string') {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tb === 'string' && record.id != null) {
      return `${record.tb}:${String(record.id)}`;
    }

    if (record.id != null) return recordId(record.id);
  }

  return String(value);
}

async function getCurrentUserGroupIds(userId: string) {
  const userKey = parseUsersRecordKey(userId);
  const userThingId = toUserThingId(userId);
  if (!userKey || !userThingId) return new Set<string>();

  try {
    const db = await getDB();
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
        .map((groupId) => toGroupThingId(recordId(groupId)))
        .filter(Boolean),
    );
  } catch (error) {
    console.warn(
      '[API /contests/all] Не удалось получить группы пользователя:',
      error,
    );
    return new Set<string>();
  }
}

function toRecordSet(
  values: unknown[] | undefined,
  normalizer: (id: string) => string,
) {
  return new Set((values || []).map((value) => normalizer(recordId(value))));
}

function canSeeInternalEvent(
  event: CalendarEvent,
  options: {
    role?: string;
    userId?: string;
    groupIds: Set<string>;
  },
) {
  if (event.source !== 'events') return true;

  const visibility = event.visibility_type === 'private' ? 'private' : 'public';
  if (!options.userId) return visibility === 'public';
  if (options.role === 'admin') return true;

  const userThingId = toUserThingId(options.userId);
  const createdBy = toUserThingId(recordId(event.created_by));

  if (options.role === 'coach') {
    return createdBy === userThingId;
  }

  if (visibility === 'public') return true;

  const participants = toRecordSet(event.participant_list, toUserThingId);
  if (participants.has(userThingId)) return true;

  const targetGroups = toRecordSet(event.target_groups, toGroupThingId);
  return [...targetGroups].some((groupId) => options.groupIds.has(groupId));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ? recordId(session.user.id) : undefined;
  const role = session?.user?.role;
  const groupIds = userId
    ? await getCurrentUserGroupIds(userId)
    : new Set<string>();
  const events = await listCalendarEvents({
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    includeContests: searchParams.get('includeContests') !== 'false',
    includeEvents: searchParams.get('includeEvents') !== 'false',
  });
  const visibleEvents = events.filter((event) =>
    canSeeInternalEvent(event, { role, userId, groupIds }),
  );

  return NextResponse.json(visibleEvents);
}
