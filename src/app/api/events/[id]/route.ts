import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import { validateEventSchedule } from '@/lib/events/validation';
import { toGroupThingId, toUserThingId } from '@/lib/surreal/ids';
import type { Event, UpdateEventData } from '@/lib/types/event';

function toEventThingId(id: string): string {
  const value = (id || '').trim();
  if (!value) return '';
  return value.startsWith('events:') ? value : `events:${value}`;
}

function rowsFromQuery(result: unknown): Record<string, unknown>[] {
  if (!Array.isArray(result)) return [];

  const first = result[0] as { result?: unknown } | unknown[] | undefined;
  if (Array.isArray(first)) {
    return first.filter(
      (row): row is Record<string, unknown> =>
        typeof row === 'object' && row !== null,
    );
  }

  if (first && typeof first === 'object' && Array.isArray(first.result)) {
    return first.result.filter(
      (row): row is Record<string, unknown> =>
        typeof row === 'object' && row !== null,
    );
  }

  return result.filter(
    (row): row is Record<string, unknown> =>
      typeof row === 'object' && row !== null,
  );
}

function recordId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return decodeURIComponent(value);

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tb === 'string' && record.id != null) {
      return `${record.tb}:${String(record.id)}`;
    }

    if (record.id != null) return recordId(record.id);
  }

  return String(value);
}

function normalizeIds(values: unknown, normalizer: (value: string) => string) {
  return Array.isArray(values)
    ? values.map((value) => normalizer(recordId(value))).filter(Boolean)
    : [];
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function ensureCanManageEvent(
  eventId: string,
  userId: string,
  role: string | undefined,
) {
  if (role !== 'coach' && role !== 'admin') {
    return {
      ok: false as const,
      response: jsonError('Доступно только тренерам и администраторам', 403),
    };
  }

  if (role === 'admin') {
    return { ok: true as const };
  }

  const db = await getDB();
  if (!db) {
    throw new Error('Не удалось подключиться к базе данных SurrealDB');
  }

  const checkResult = await db.query(
    `SELECT created_by, platform FROM type::thing($id)`,
    {
      id: eventId,
    },
  );
  const existingEvent = rowsFromQuery(checkResult)[0];

  if (!existingEvent) {
    return {
      ok: false as const,
      response: jsonError('Мероприятие не найдено', 404),
    };
  }

  const createdBy = toUserThingId(recordId(existingEvent.created_by));
  if (createdBy !== toUserThingId(userId)) {
    return {
      ok: false as const,
      response: jsonError('Вы можете менять только свои мероприятия', 403),
    };
  }

  if (existingEvent.platform !== 'custom') {
    return {
      ok: false as const,
      response: jsonError(
        'Тренер может изменять только мероприятия со своей ссылкой',
        403,
      ),
    };
  }

  return { ok: true as const };
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return jsonError('Не авторизован', 401);
    }

    const url = new URL(req.url);
    const rawId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const eventId = toEventThingId(rawId);

    if (!eventId) {
      return jsonError('Не указан ID мероприятия', 400);
    }

    const access = await ensureCanManageEvent(
      eventId,
      session.user.id.toString(),
      session.user.role,
    );
    if (!access.ok) return access.response;

    const body = (await req.json()) as UpdateEventData;
    const db = await getDB();
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных SurrealDB');
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields: (keyof UpdateEventData)[] = [
      'title',
      'description',
      'platform',
      'status',
      'start_time_utc',
      'end_time_utc',
      'external_link',
      'visibility_type',
      'participant_list',
      'target_groups',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (
      session.user.role === 'coach' &&
      updateData.platform !== undefined &&
      updateData.platform !== 'custom'
    ) {
      return jsonError(
        'Тренер может использовать только мероприятия со своей ссылкой',
        403,
      );
    }

    if (updateData.participant_list !== undefined) {
      updateData.participant_list = normalizeIds(
        updateData.participant_list,
        toUserThingId,
      );
    }

    if (updateData.target_groups !== undefined) {
      updateData.target_groups = normalizeIds(
        updateData.target_groups,
        toGroupThingId,
      );
    }

    if (
      updateData.visibility_type === 'private' ||
      updateData.participant_list !== undefined ||
      updateData.target_groups !== undefined
    ) {
      const existingCheck = await db.query(
        `SELECT visibility_type, participant_list, target_groups FROM type::thing($id)`,
        { id: eventId },
      );
      const existing = rowsFromQuery(existingCheck)[0] || {};
      const nextVisibility =
        (updateData.visibility_type as string | undefined) ??
        (existing.visibility_type as string | undefined);
      const nextParticipants =
        (updateData.participant_list as unknown[] | undefined) ??
        (existing.participant_list as unknown[] | undefined) ??
        [];
      const nextGroups =
        (updateData.target_groups as unknown[] | undefined) ??
        (existing.target_groups as unknown[] | undefined) ??
        [];

      if (
        nextVisibility === 'private' &&
        nextParticipants.length === 0 &&
        nextGroups.length === 0
      ) {
        return jsonError(
          'Для private мероприятия необходимо указать participant_list или target_groups',
          400,
        );
      }
    }

    if (
      updateData.status !== undefined ||
      updateData.start_time_utc !== undefined ||
      updateData.end_time_utc !== undefined
    ) {
      const existingSchedule =
        rowsFromQuery(
          await db.query(
            `SELECT status, start_time_utc, end_time_utc FROM type::thing($id)`,
            { id: eventId },
          ),
        )[0] || {};
      const scheduleError = validateEventSchedule({
        status: String(updateData.status ?? existingSchedule.status),
        start: String(
          updateData.start_time_utc ?? existingSchedule.start_time_utc,
        ),
        end: String(updateData.end_time_utc ?? existingSchedule.end_time_utc),
      });

      if (scheduleError) {
        return jsonError(scheduleError, 400);
      }
    }

    const setClauses: string[] = [];
    const params: Record<string, unknown> = { id: eventId };

    if (updateData.title) {
      setClauses.push('title = $title');
      params.title = updateData.title;
    }
    if (updateData.description !== undefined) {
      setClauses.push('description = $description');
      params.description = updateData.description;
    }
    if (updateData.platform) {
      setClauses.push('platform = $platform');
      params.platform = updateData.platform;
    }
    if (updateData.status) {
      setClauses.push('status = $status');
      params.status = updateData.status;
    }
    if (updateData.start_time_utc) {
      setClauses.push('start_time_utc = type::datetime($start_time_utc)');
      params.start_time_utc = new Date(
        String(updateData.start_time_utc),
      ).toISOString();
    }
    if (updateData.end_time_utc) {
      setClauses.push('end_time_utc = type::datetime($end_time_utc)');
      params.end_time_utc = new Date(
        String(updateData.end_time_utc),
      ).toISOString();
    }
    if (updateData.external_link) {
      setClauses.push('external_link = $external_link');
      params.external_link = updateData.external_link;
    }
    if (updateData.visibility_type) {
      setClauses.push('visibility_type = $visibility_type');
      params.visibility_type = updateData.visibility_type;
    }
    if (updateData.participant_list !== undefined) {
      setClauses.push('participant_list = $participant_list');
      params.participant_list = updateData.participant_list;
    }
    if (updateData.target_groups !== undefined) {
      setClauses.push('target_groups = $target_groups');
      params.target_groups = updateData.target_groups;
    }
    if (setClauses.length === 0) {
      return jsonError('Нет данных для обновления', 400);
    }

    setClauses.push('updated_at = time::now()');

    const result = await db.query(
      `UPDATE type::thing($id) SET ${setClauses.join(', ')}`,
      params,
    );
    const updatedEvent = rowsFromQuery(result)[0] as unknown as
      | Event
      | undefined;

    return NextResponse.json(
      { ok: true, data: updatedEvent, message: 'Мероприятие обновлено' },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API PUT /events/[id] Error:', errorMessage);
    return jsonError('Ошибка сервера', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return jsonError('Не авторизован', 401);
    }

    const url = new URL(req.url);
    const rawId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const eventId = toEventThingId(rawId);

    if (!eventId) {
      return jsonError('Не указан ID мероприятия', 400);
    }

    const access = await ensureCanManageEvent(
      eventId,
      session.user.id.toString(),
      session.user.role,
    );
    if (!access.ok) return access.response;

    const db = await getDB();
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных SurrealDB');
    }

    await db.query(`DELETE type::thing($id)`, { id: eventId });

    return NextResponse.json(
      { ok: true, message: 'Мероприятие удалено' },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API DELETE /events/[id] Error:', errorMessage);
    return jsonError('Ошибка сервера', 500);
  }
}
