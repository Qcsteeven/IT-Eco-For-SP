import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDB } from '@/lib/surreal/surreal';
import { toGroupThingId, toUserThingId } from '@/lib/surreal/ids';

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

function recordId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tb === 'string' && record.id != null) {
      return `${record.tb}:${String(record.id)}`;
    }

    if (record.id != null) return recordId(record.id);
  }

  return String(value);
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function groupIdFromRequest(req: NextRequest) {
  const parts = req.nextUrl.pathname.split('/');
  const rawId = decodeURIComponent(parts[3] || '');
  return toGroupThingId(rawId);
}

async function canAccessGroup(
  db: NonNullable<Awaited<ReturnType<typeof getDB>>>,
  groupId: string,
  userId: string,
  role: string,
) {
  if (role === 'admin') return true;

  const table = role === 'coach' ? 'group_coaches' : 'group_members';
  const userField = role === 'coach' ? 'coach_id' : 'user_id';
  const result = await db.query(
    `SELECT id FROM ${table}
     WHERE group_id = type::thing($groupId)
       AND ${userField} = type::thing($userId)
     LIMIT 1;`,
    { groupId, userId },
  );

  return rowsFromQuery(result).length > 0;
}

async function getAccessContext(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { response: jsonError('Не авторизован', 401) };
  }

  const db = await getDB();
  if (!db) {
    throw new Error('Не удалось подключиться к базе данных SurrealDB');
  }

  const groupId = groupIdFromRequest(req);
  if (!groupId) {
    return { response: jsonError('Не указан ID группы', 400) };
  }

  const userId = toUserThingId(session.user.id.toString());
  const role = (session.user.role as string | undefined) || 'user';
  const allowed = await canAccessGroup(db, groupId, userId, role);

  if (!allowed) {
    return { response: jsonError('Доступ запрещен', 403) };
  }

  return { db, groupId, userId, role };
}

export async function GET(req: NextRequest) {
  try {
    const context = await getAccessContext(req);
    if ('response' in context) return context.response;

    const result = await context.db.query(
      `SELECT
        user_id,
        user_id.full_name AS full_name,
        user_id.email AS email,
        joined_at
      FROM group_members
      WHERE group_id = type::thing($groupId)
      ORDER BY joined_at DESC
      FETCH user_id;`,
      { groupId: context.groupId },
    );

    const members = rowsFromQuery<{
      user_id?: unknown;
      full_name?: unknown;
      email?: unknown;
      joined_at?: unknown;
    }>(result).map((member) => ({
      ...member,
      user_id: recordId(member.user_id),
      full_name: String(member.full_name || ''),
      email: String(member.email || ''),
      joined_at: String(member.joined_at || ''),
    }));

    return NextResponse.json({ ok: true, data: members }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API GET /groups/[id]/members Error:', errorMessage);
    return jsonError(errorMessage, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await getAccessContext(req);
    if ('response' in context) return context.response;

    if (context.role !== 'coach' && context.role !== 'admin') {
      return jsonError('Доступно только тренерам и администраторам', 403);
    }

    const body = (await req.json()) as { user_ids?: string[] };
    const userIds = (body.user_ids || []).map(toUserThingId).filter(Boolean);

    if (userIds.length === 0) {
      return jsonError('Выберите хотя бы одного участника', 400);
    }

    let added = 0;
    for (const userId of userIds) {
      const existsResult = await context.db.query(
        `SELECT count() AS count FROM group_members
         WHERE group_id = type::thing($groupId)
           AND user_id = type::thing($userId);`,
        { groupId: context.groupId, userId },
      );
      const count = rowsFromQuery<{ count?: unknown }>(existsResult)[0]?.count;
      const exists = Number(count || 0) > 0;

      if (exists) continue;

      await context.db.query(
        `CREATE group_members CONTENT {
          group_id: type::thing($groupId),
          user_id: type::thing($userId),
          joined_at: time::now()
        };`,
        { groupId: context.groupId, userId },
      );
      added += 1;
    }

    return NextResponse.json(
      { ok: true, message: 'Участники добавлены', added },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API POST /groups/[id]/members Error:', errorMessage);
    return jsonError(errorMessage, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const context = await getAccessContext(req);
    if ('response' in context) return context.response;

    if (context.role !== 'coach' && context.role !== 'admin') {
      return jsonError('Доступно только тренерам и администраторам', 403);
    }

    const body = (await req.json()) as { user_id?: string };
    const userId = toUserThingId(body.user_id || '');

    if (!userId) {
      return jsonError('Не указан участник', 400);
    }

    await context.db.query(
      `DELETE group_members
       WHERE group_id = type::thing($groupId)
         AND user_id = type::thing($userId);`,
      { groupId: context.groupId, userId },
    );

    return NextResponse.json(
      { ok: true, message: 'Участник удален' },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API DELETE /groups/[id]/members Error:', errorMessage);
    return jsonError(errorMessage, 500);
  }
}
