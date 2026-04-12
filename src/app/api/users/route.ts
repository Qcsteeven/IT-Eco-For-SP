import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';

/**
 * GET /api/users
 * 
 * Получение списка пользователей для назначения на мероприятия.
 * Доступно только coach и admin.
 * 
 * Query params:
 * - search?: string — поиск по имени/email
 * - group?: string — фильтр по группе (если есть)
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    // Только coach и admin могут просматривать список пользователей
    if (session.user.role !== 'coach' && session.user.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Доступно только тренерам и администраторам' },
        { status: 403 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    // Parse query params
    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    // Базовый запрос — только верифицированные пользователи
    let query = `SELECT id, full_name, email, role, registration_date FROM users WHERE is_verified = true`;
    const params: Record<string, unknown> = {};

    if (search) {
      query += ` AND (full_name CONTAINS $search OR email CONTAINS $search)`;
      params.search = search;
    }

    // Не возвращаем хеши паролей и чувствительные данные
    query += ` ORDER BY full_name ASC LIMIT $limit;`;
    params.limit = limit;

    const result = await db.query(query, params);
    const users = (result[0] as Record<string, unknown>[]) || [];

    return NextResponse.json(
      { ok: true, data: users, total: users.length },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 },
    );
  }
}
