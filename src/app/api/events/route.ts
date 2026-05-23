import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import { validateEventSchedule } from '@/lib/events/validation';
import {
  parseUsersRecordKey,
  toGroupThingId,
  toUserThingId,
} from '@/lib/surreal/ids';
import type {
  CreateEventData,
  Event,
  EventVisibility,
} from '@/lib/types/event';

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

function normalizeEvent(event: Event): Event {
  const record = event as unknown as Record<string, unknown>;

  return {
    ...event,
    id: toRecordIdString(record.id),
    created_by: toRecordIdString(record.created_by),
    participant_list: (event.participant_list || []).map(String),
    target_groups: (event.target_groups || []).map(String),
    participant_snapshot: (event.participant_snapshot || []).map(String),
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    if (session.user.role !== 'coach' && session.user.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Доступно только тренерам и администраторам' },
        { status: 403 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к SurrealDB');

    const params: Record<string, unknown> = {};
    let query = 'SELECT * FROM events';

    if (session.user.role === 'coach') {
      query +=
        ' WHERE created_by = type::thing("users", $createdById) OR created_by = type::thing("users", $legacyCreatedById)';
      params.createdById = parseUsersRecordKey(session.user.id.toString());
      params.legacyCreatedById = toUserThingId(session.user.id.toString());
    }

    query += ' ORDER BY start_time_utc ASC;';

    const result = await db.query<Event[][]>(query, params);
    const events = (result[0] || []).map(normalizeEvent);

    return NextResponse.json({ ok: true, data: events }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[API /events GET] Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let rawBodyForLog: unknown = undefined;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    if (session.user.role !== 'coach' && session.user.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Доступно только тренерам и администраторам' },
        { status: 403 },
      );
    }

    rawBodyForLog = await req.json().catch(() => ({}));
    const body = rawBodyForLog as CreateEventData;

    const requiredFields: (keyof CreateEventData)[] = [
      'title',
      'platform',
      'status',
      'start_time_utc',
      'end_time_utc',
      'external_link',
      'visibility_type',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { ok: false, error: `Отсутствует обязательное поле: ${field}` },
          { status: 400 },
        );
      }
    }

    const validVisibility: EventVisibility[] = ['public', 'private'];
    if (!validVisibility.includes(body.visibility_type)) {
      return NextResponse.json(
        { ok: false, error: 'visibility_type должен быть public или private' },
        { status: 400 },
      );
    }

    if (session.user.role === 'coach' && body.platform !== 'custom') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Тренер может создавать только мероприятия со своей ссылкой',
        },
        { status: 403 },
      );
    }

    const normalizedParticipants = (body.participant_list || [])
      .map(toUserThingId)
      .filter(Boolean);
    const normalizedGroups = (body.target_groups || [])
      .map(toGroupThingId)
      .filter(Boolean);

    if (
      body.visibility_type === 'private' &&
      normalizedParticipants.length === 0 &&
      normalizedGroups.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Для private мероприятия нужно указать participant_list или target_groups',
        },
        { status: 400 },
      );
    }

    const startDate = new Date(body.start_time_utc);
    const endDate = new Date(body.end_time_utc);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'Некорректная дата начала или окончания' },
        { status: 400 },
      );
    }

    const scheduleError = validateEventSchedule({
      status: body.status,
      start: startDate,
      end: endDate,
    });
    if (scheduleError) {
      return NextResponse.json(
        { ok: false, error: scheduleError },
        { status: 400 },
      );
    }

    const startDateTime = startDate.toISOString();
    const endDateTime = endDate.toISOString();

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к SurrealDB');

    const result = await db.query<Event[][]>(
      `CREATE events CONTENT {
        title: $title,
        description: $description,
        platform: $platform,
        status: $status,
        start_time_utc: type::datetime($start_time_utc),
        end_time_utc: type::datetime($end_time_utc),
        external_link: $external_link,
        visibility_type: $visibility_type,
        participant_list: $participant_list,
        target_groups: $target_groups,
        participant_snapshot: NONE,
        created_by: type::thing("users", $created_by_id),
        created_at: time::now(),
        updated_at: time::now()
      };`,
      {
        title: body.title,
        description: body.description || '',
        platform: body.platform,
        status: body.status,
        start_time_utc: startDateTime,
        end_time_utc: endDateTime,
        external_link: body.external_link,
        visibility_type: body.visibility_type,
        participant_list: normalizedParticipants,
        target_groups: normalizedGroups,
        created_by_id: parseUsersRecordKey(session.user.id.toString()),
      },
    );

    const createdEventRaw = result[0]?.[0];
    const createdEvent = createdEventRaw
      ? normalizeEvent(createdEventRaw)
      : createdEventRaw;

    return NextResponse.json(
      { ok: true, data: createdEvent, message: 'Мероприятие создано' },
      { status: 201 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API POST /events Error:', errorMessage);
    console.error('Request body:', JSON.stringify(rawBodyForLog ?? {}, null, 2));
    return NextResponse.json(
      { ok: false, error: `Ошибка сервера: ${errorMessage}` },
      { status: 500 },
    );
  }
}
