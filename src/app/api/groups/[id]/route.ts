import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDB } from '@/lib/surreal/surreal';
import { toGroupThingId, toUserThingId } from '@/lib/surreal/ids';
import type { Group, UpdateGroupData } from '@/lib/types/group';

type DbRow = Record<string, unknown>;

function rowsFromQuery<T extends DbRow = DbRow>(result: unknown): T[] {
  if (!Array.isArray(result)) return [];

  const first = result[0] as { result?: unknown } | unknown[] | undefined;
  if (Array.isArray(first)) {
    return first.filter(
      (row): row is T => typeof row === 'object' && row !== null,
    );
  }

  if (first && typeof first === 'object' && Array.isArray(first.result)) {
    return first.result.filter(
      (row): row is T => typeof row === 'object' && row !== null,
    );
  }

  return result.filter(
    (row): row is T => typeof row === 'object' && row !== null,
  );
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function groupIdFromRequest(req: NextRequest) {
  const rawId = decodeURIComponent(req.nextUrl.pathname.split('/').pop() || '');
  return toGroupThingId(rawId);
}

async function canAccessGroup(
  db: NonNullable<Awaited<ReturnType<typeof getDB>>>,
  groupId: string,
  userId: string,
  role: string,
) {
  if (role === 'admin') return true;

  if (role === 'coach') {
    const result = await db.query(
      `SELECT id FROM group_coaches
       WHERE group_id = type::thing($groupId)
         AND coach_id = type::thing($userId)
       LIMIT 1;`,
      { groupId, userId },
    );
    return rowsFromQuery(result).length > 0;
  }

  const result = await db.query(
    `SELECT id FROM group_members
     WHERE group_id = type::thing($groupId)
       AND user_id = type::thing($userId)
     LIMIT 1;`,
    { groupId, userId },
  );
  return rowsFromQuery(result).length > 0;
}

async function getAccessContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { response: jsonError('Не авторизован', 401) };
  }

  const db = await getDB();
  if (!db) {
    throw new Error('Не удалось подключиться к базе данных SurrealDB');
  }

  return {
    db,
    userId: toUserThingId(session.user.id.toString()),
    role: (session.user.role as string | undefined) || 'user',
  };
}

export async function GET(req: NextRequest) {
  try {
    const context = await getAccessContext();
    if ('response' in context) return context.response;

    const groupId = groupIdFromRequest(req);
    if (!groupId) return jsonError('Не указан ID группы', 400);

    const allowed = await canAccessGroup(
      context.db,
      groupId,
      context.userId,
      context.role,
    );
    if (!allowed) return jsonError('Доступ запрещен', 403);

    const result = await context.db.query<Group[]>(
      `SELECT * FROM type::thing($groupId) LIMIT 1;`,
      { groupId },
    );
    const group = rowsFromQuery<Group & DbRow>(result)[0];

    if (!group || group.is_archived === true) {
      return jsonError('Группа не найдена', 404);
    }

    return NextResponse.json({ ok: true, data: group }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API GET /groups/[id] Error:', errorMessage);
    return jsonError(errorMessage, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await getAccessContext();
    if ('response' in context) return context.response;

    if (context.role !== 'coach' && context.role !== 'admin') {
      return jsonError('Доступно только тренерам и администраторам', 403);
    }

    const groupId = groupIdFromRequest(req);
    if (!groupId) return jsonError('Не указан ID группы', 400);

    const allowed = await canAccessGroup(
      context.db,
      groupId,
      context.userId,
      context.role,
    );
    if (!allowed) return jsonError('Доступ запрещен', 403);

    const body = (await req.json()) as UpdateGroupData;
    const setClauses: string[] = [];
    const params: Record<string, unknown> = { groupId };

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return jsonError('Название группы обязательно', 400);
      setClauses.push('name = $name');
      params.name = name;
    }

    if (body.description !== undefined) {
      setClauses.push('description = $description');
      params.description = (body.description || '').trim();
    }

    if (body.is_archived !== undefined) {
      setClauses.push('is_archived = $is_archived');
      params.is_archived = Boolean(body.is_archived);
    }

    if (setClauses.length === 0) {
      return jsonError('Нет данных для обновления', 400);
    }

    setClauses.push('updated_at = time::now()');

    const result = await context.db.query<Group[]>(
      `UPDATE type::thing($groupId) SET ${setClauses.join(', ')};`,
      params,
    );
    const group = rowsFromQuery<Group & DbRow>(result)[0];

    return NextResponse.json(
      { ok: true, data: group, message: 'Группа обновлена' },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API PATCH /groups/[id] Error:', errorMessage);
    return jsonError(errorMessage, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const context = await getAccessContext();
    if ('response' in context) return context.response;

    if (context.role !== 'coach' && context.role !== 'admin') {
      return jsonError('Доступно только тренерам и администраторам', 403);
    }

    const groupId = groupIdFromRequest(req);
    if (!groupId) return jsonError('Не указан ID группы', 400);

    const allowed = await canAccessGroup(
      context.db,
      groupId,
      context.userId,
      context.role,
    );
    if (!allowed) return jsonError('Доступ запрещен', 403);

    const result = await context.db.query<Group[]>(
      `UPDATE type::thing($groupId)
       SET is_archived = true, updated_at = time::now();`,
      { groupId },
    );
    const group = rowsFromQuery<Group & DbRow>(result)[0];

    return NextResponse.json(
      { ok: true, data: group, message: 'Группа архивирована' },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API DELETE /groups/[id] Error:', errorMessage);
    return jsonError(errorMessage, 500);
  }
}
