import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import { toUserThingId } from '@/lib/surreal/ids';

function toRecordIdString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const anyV = v as Record<string, unknown>;
    if (typeof anyV.tb === 'string' && anyV.id != null) return `${anyV.tb}:${String(anyV.id)}`;
    if (typeof anyV.id === 'string') return anyV.id;
  }
  return String(v);
}

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
    console.log('[Users API] Session:', JSON.stringify(session?.user, null, 2));
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    // Только coach и admin могут просматривать список пользователей
    if (session.user.role !== 'coach' && session.user.role !== 'admin') {
      console.warn('[Users API] Access denied. Role:', session.user.role);
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
    const group = url.searchParams.get('group');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const role = session.user.role as string;
    const coachId = toUserThingId(session.user.id.toString());

    // Базовый запрос — только верифицированные пользователи
    let query = `SELECT id, full_name, email, role, registration_date FROM users WHERE is_verified = true`;
    const params: Record<string, unknown> = { coachId };

    if (role === 'coach' && group) {
      query += `
        AND id IN (
          SELECT VALUE user_id
          FROM group_members
          WHERE group_id = type::thing($group)
            AND group_id IN (
              SELECT VALUE group_id
              FROM group_coaches
              WHERE coach_id = type::thing($coachId)
            )
        )`;
      params.group = group;
    } else if (group) {
      query += `
        AND id IN (
          SELECT VALUE user_id
          FROM group_members
          WHERE group_id = type::thing($group)
        )`;
      params.group = group;
    }

    if (search) {
      query += ` AND (full_name CONTAINS $search OR email CONTAINS $search)`;
      params.search = search;
    }

    // Не возвращаем хеши паролей и чувствительные данные
    query += ` ORDER BY full_name ASC LIMIT $limit;`;
    params.limit = limit;

    const result = await db.query(query, params);
    const usersRaw = (result[0] as Record<string, unknown>[]) || [];
    const users = usersRaw.map((u) => ({ ...u, id: toRecordIdString(u.id) }));

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
