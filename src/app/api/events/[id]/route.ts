import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import { validateEventSchedule } from '@/lib/events/validation';
import { toGroupThingId, toUserThingId } from '@/lib/surreal/ids';
import type { Event, UpdateEventData } from '@/lib/types/event';

function parseEventsRecordKey(id: string): string {
  const s = (id || '').trim();
  if (!s) return '';
  return s.startsWith('events:') ? s.slice('events:'.length) : s;
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

/**
 * PUT /api/events/[id]
 *
 * Обновление мероприятия. Доступно только coach и admin.
 * Coach может редактировать только свои созданные мероприятия.
 * Admin может редактировать все.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    // Только coach и admin могут обновлять
    if (session.user.role !== 'coach' && session.user.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Доступно только тренерам и администраторам' },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const rawId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const eventId = parseEventsRecordKey(rawId);

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: 'Не указан ID мероприятия' },
        { status: 400 },
      );
    }

    const body = (await req.json()) as UpdateEventData;
    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const existingResult = await db.query(
      `SELECT * FROM type::thing("events", $id)`,
      { id: eventId },
    );
    const existingEvent = (existingResult[0] as unknown as Event[])?.[0];

    if (!existingEvent) {
      return NextResponse.json(
        { ok: false, error: 'Мероприятие не найдено' },
        { status: 404 },
      );
    }

    // Проверяем доступы: coach может редактировать только свои события со своей ссылкой.
    if (session.user.role === 'coach') {
      const createdBy = toRecordIdString(
        (existingEvent as unknown as Record<string, unknown>).created_by,
      );
      const userId = toUserThingId(session.user.id.toString());
      const legacyUserId = `users:${userId}`;
      if (createdBy !== userId && createdBy !== legacyUserId) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Вы можете редактировать только свои мероприятия',
          },
          { status: 403 },
        );
      }

      if (existingEvent.platform !== 'custom') {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Тренер может редактировать только мероприятия со своей ссылкой',
          },
          { status: 403 },
        );
      }
    }

    // Формируем данные для обновления
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
      return NextResponse.json(
        {
          ok: false,
          error: 'Тренер может использовать только мероприятия со своей ссылкой',
        },
        { status: 403 },
      );
    }

    // Нормализация ID для participant_list/target_groups
    if (updateData.participant_list !== undefined) {
      updateData.participant_list = (updateData.participant_list as string[])
        .map(toUserThingId)
        .filter(Boolean);
    }
    if (updateData.target_groups !== undefined) {
      updateData.target_groups = (updateData.target_groups as string[])
        .map(toGroupThingId)
        .filter(Boolean);
    }

    // Валидация: если visibility_type=private, нужно participant_list или target_groups
    if (
      updateData.visibility_type === 'private' ||
      updateData.participant_list !== undefined ||
      updateData.target_groups !== undefined
    ) {
      const existing = existingEvent as unknown as Record<string, unknown>;
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
        return NextResponse.json(
          {
            ok: false,
            error:
              'Для private мероприятия необходимо указать participant_list или target_groups',
          },
          { status: 400 },
        );
      }
    }

    if (
      updateData.status !== undefined ||
      updateData.start_time_utc !== undefined ||
      updateData.end_time_utc !== undefined
    ) {
      const scheduleError = validateEventSchedule({
        status: String(updateData.status ?? existingEvent.status),
        start: String(updateData.start_time_utc ?? existingEvent.start_time_utc),
        end: String(updateData.end_time_utc ?? existingEvent.end_time_utc),
      });

      if (scheduleError) {
        return NextResponse.json(
          { ok: false, error: scheduleError },
          { status: 400 },
        );
      }
    }

    updateData.updated_at = 'time::now()';

    // Формируем SQL с правильными типами
    const setClauses: string[] = [];
    const params: Record<string, unknown> = {
      id: eventId,
    };

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
    setClauses.push('updated_at = time::now()');

    const result = await db.query(
      `UPDATE type::thing("events", $id) SET ${setClauses.join(', ')}`,
      params,
    );

    const updatedEvent = (result[0] as unknown as Event[])?.[0];

    return NextResponse.json(
      { ok: true, data: updatedEvent, message: 'Мероприятие обновлено' },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API PUT Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/events/[id]
 *
 * Удаление мероприятия. Доступно только coach и admin.
 * Coach может удалять только свои созданные мероприятия.
 * Admin может удалять все.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    // Только coach и admin могут удалять
    if (session.user.role !== 'coach' && session.user.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Доступно только тренерам и администраторам' },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const rawId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const eventId = parseEventsRecordKey(rawId);

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: 'Не указан ID мероприятия' },
        { status: 400 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    // Проверяем доступы: coach может удалять только свои
    if (session.user.role === 'coach') {
      const checkResult = await db.query(
        `SELECT created_by FROM type::thing("events", $id)`,
        { id: eventId },
      );
      const existing = (checkResult[0] as Record<string, unknown>[])?.[0];
      const createdBy = toRecordIdString(existing?.created_by);
      const userId = toUserThingId(session.user.id.toString());
      const legacyUserId = `users:${userId}`;

      if (createdBy !== userId && createdBy !== legacyUserId) {
        return NextResponse.json(
          { ok: false, error: 'Вы можете удалять только свои мероприятия' },
          { status: 403 },
        );
      }
    }

    await db.query(`DELETE type::thing("events", $id)`, {
      id: eventId,
    });

    return NextResponse.json(
      { ok: true, message: 'Мероприятие удалено' },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API DELETE Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}
