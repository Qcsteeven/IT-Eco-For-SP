import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDB } from '@/lib/surreal/surreal';
import { successResponse, errorResponse } from '@/lib/types/api';

/**
 * Тип контеста (соответствует структуре в SurrealDB)
 */
interface ContestRecord {
  id: string;
  title: string;
  platform: string;
  status?: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link?: string;
  platform_contest_id?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * GET — получить все контесты (с фильтрацией по статусу)
 */
export async function GET(req: Request) {
  try {
    const db = await getDB();
    if (!db) {
      return NextResponse.json(
        errorResponse('Ошибка подключения к БД'),
        { status: 500 },
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = 'SELECT * FROM contests';
    const vars: Record<string, unknown> = {};

    if (status) {
      query += ' WHERE status = $status';
      vars.status = status;
    }

    query += ' ORDER BY start_time_utc ASC';

    const result = await db.query<ContestRecord[][]>(query, vars);
    const contests = result[0] || [];

    return NextResponse.json(successResponse(contests));
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[API /contests GET] Error:', errorMessage);
    return NextResponse.json(
      errorResponse('Ошибка сервера при получении контестов'),
      { status: 500 },
    );
  }
}

/**
 * POST — создать новый контест (только для авторизованных)
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        errorResponse('Требуется авторизация'),
        { status: 401 },
      );
    }

    const body = await req.json();
    const {
      title,
      platform,
      start_time_utc,
      end_time_utc,
      registration_link,
      platform_contest_id,
      description,
      status = 'upcoming',
    } = body;

    // Валидация обязательных полей
    if (!title || !platform || !start_time_utc || !end_time_utc) {
      return NextResponse.json(
        errorResponse(
          'Обязательные поля: title, platform, start_time_utc, end_time_utc',
        ),
        { status: 400 },
      );
    }

    const db = await getDB();
    if (!db) {
      return NextResponse.json(
        errorResponse('Ошибка подключения к БД'),
        { status: 500 },
      );
    }

    const result = await db.query<ContestRecord[][]>(
      `CREATE contests SET
        title = $title,
        platform = $platform,
        start_time_utc = $start_time_utc,
        end_time_utc = $end_time_utc,
        registration_link = $registration_link,
        platform_contest_id = $platform_contest_id,
        description = $description,
        status = $status,
        created_at = time::now(),
        updated_at = time::now(),
        created_by = type::thing($userId);`,
      {
        title,
        platform,
        start_time_utc,
        end_time_utc,
        registration_link: registration_link || null,
        platform_contest_id: platform_contest_id || null,
        description: description || null,
        status,
        userId: session.user.id,
      },
    );

    const created = (result[0] as ContestRecord[])[0];

    return NextResponse.json(successResponse(created), { status: 201 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[API /contests POST] Error:', errorMessage);
    return NextResponse.json(
      errorResponse('Ошибка сервера при создании контеста'),
      { status: 500 },
    );
  }
}

/**
 * PUT — обновить контест по ID (только для авторизованных)
 */
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        errorResponse('Требуется авторизация'),
        { status: 401 },
      );
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        errorResponse('Необходимо указать id контеста'),
        { status: 400 },
      );
    }

    const db = await getDB();
    if (!db) {
      return NextResponse.json(
        errorResponse('Ошибка подключения к БД'),
        { status: 500 },
      );
    }

    // Фильтруем undefined/null поля
    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        errorResponse('Нет полей для обновления'),
        { status: 400 },
      );
    }

    // Формируем SET-выражение динамически
    const setFields = Object.keys(filteredUpdates)
      .map((key) => `${key} = $${key}`)
      .join(', ');

    const queryVars: Record<string, unknown> = {
      id,
      ...filteredUpdates,
      updated_at: new Date().toISOString(),
    };

    const result = await db.query<ContestRecord[][]>(
      `UPDATE type::thing($id) SET ${setFields}, updated_at = $updated_at`,
      queryVars,
    );

    const updated = (result[0] as ContestRecord[])[0];

    if (!updated) {
      return NextResponse.json(
        errorResponse('Контест не найден'),
        { status: 404 },
      );
    }

    return NextResponse.json(successResponse(updated));
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[API /contests PUT] Error:', errorMessage);
    return NextResponse.json(
      errorResponse('Ошибка сервера при обновлении контеста'),
      { status: 500 },
    );
  }
}

/**
 * DELETE — удалить контест по ID (только для авторизованных)
 */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        errorResponse('Требуется авторизация'),
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        errorResponse('Необходимо указать id контеста'),
        { status: 400 },
      );
    }

    const db = await getDB();
    if (!db) {
      return NextResponse.json(
        errorResponse('Ошибка подключения к БД'),
        { status: 500 },
      );
    }

    await db.query(`DELETE type::thing($id)`, { id });

    return NextResponse.json(
      successResponse({ deleted: true, id }),
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[API /contests DELETE] Error:', errorMessage);
    return NextResponse.json(
      errorResponse('Ошибка сервера при удалении контеста'),
      { status: 500 },
    );
  }
}
