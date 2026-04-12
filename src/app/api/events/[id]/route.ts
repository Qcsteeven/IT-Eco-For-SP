import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import type { Event, UpdateEventData } from '@/lib/types/event';

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
    const eventId = url.pathname.split('/').pop();

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: 'Не указан ID мероприятия' },
        { status: 400 },
      );
    }

    const body = (await req.json()) as UpdateEventData;
    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    // Проверяем доступы: coach может редактировать только свои
    if (session.user.role === 'coach') {
      const checkResult = await db.query(
        `SELECT * FROM type::thing($tableName, $id)`,
        { tableName: 'contests', id: eventId },
      );
      const existingEvent = (checkResult[0] as unknown as Event[])?.[0];

      if (!existingEvent) {
        return NextResponse.json(
          { ok: false, error: 'Мероприятие не найдено' },
          { status: 404 },
        );
      }

      // Coach может редактировать только свои мероприятия
      const createdBy = existingEvent.created_by as string | undefined;
      const userId = `users:${session.user.id}`;
      if (createdBy !== userId) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Вы можете редактировать только свои мероприятия',
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
      'platform_contest_id',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Валидация: если меняется visibility_type на private, нужен participant_list
    if (updateData.visibility_type === 'private') {
      // Проверяем есть ли participant_list в обновлении или уже есть в БД
      if (!updateData.participant_list) {
        const existingCheck = await db.query(
          `SELECT participant_list FROM type::thing($tableName, $id)`,
          { tableName: 'contests', id: eventId },
        );
        const existing = (existingCheck[0] as Record<string, unknown>[])?.[0];
        const existingList = existing?.participant_list as
          | unknown[]
          | undefined;
        if (!existingList || existingList.length === 0) {
          return NextResponse.json(
            {
              ok: false,
              error:
                'Для private мероприятия необходимо указать participant_list',
            },
            { status: 400 },
          );
        }
      }
    }

    updateData.updated_at = new Date().toISOString();

    const result = await db.query(
      `UPDATE type::thing($tableName, $id) MERGE $data`,
      { tableName: 'contests', id: eventId, data: updateData },
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
    const eventId = url.pathname.split('/').pop();

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
        `SELECT created_by FROM type::thing($tableName, $id)`,
        { tableName: 'contests', id: eventId },
      );
      const existing = (checkResult[0] as Record<string, unknown>[])?.[0];
      const createdBy = existing?.created_by as string | undefined;
      const userId = `users:${session.user.id}`;

      if (createdBy !== userId) {
        return NextResponse.json(
          { ok: false, error: 'Вы можете удалять только свои мероприятия' },
          { status: 403 },
        );
      }
    }

    await db.query(`DELETE type::thing($tableName, $id)`, {
      tableName: 'contests',
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
