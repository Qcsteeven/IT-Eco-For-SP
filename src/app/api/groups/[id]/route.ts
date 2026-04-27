import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDB } from '@/lib/surreal/surreal';
import { toGroupThingId, toUserThingId } from '@/lib/surreal/ids';
import type { Group, UpdateGroupData } from '@/lib/types/group';

async function canAccessGroup(db: Awaited<ReturnType<typeof getDB>>, groupId: string, userId: string, role: string) {
  if (role === 'admin') return true;

  if (role === 'coach') {
    const res = await db.query(
      `SELECT * FROM group_coaches WHERE group_id = type::thing($groupId) AND coach_id = type::thing($userId) LIMIT 1;`,
      { groupId, userId },
    );
    return ((res[0] as unknown as unknown[]) || []).length > 0;
  }

  const res = await db.query(
    `SELECT * FROM group_members WHERE group_id = type::thing($groupId) AND user_id = type::thing($userId) LIMIT 1;`,
    { groupId, userId },
  );
  return ((res[0] as unknown as unknown[]) || []).length > 0;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Неавторизован' }, { status: 401 });
    }

    const url = new URL(req.url);
    const rawId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const groupId = toGroupThingId(rawId);

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const userId = toUserThingId(session.user.id.toString());
    const role = (session.user.role as string | undefined) || 'user';

    const ok = await canAccessGroup(db, groupId, userId, role);
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'Доступ запрещён' }, { status: 403 });
    }

    const result = await db.query<Group[][]>(
      `SELECT * FROM type::thing($table, $id) LIMIT 1;`,
      { table: 'groups', id: rawId },
    );
    const group = result[0]?.[0];
    if (!group) {
      return NextResponse.json({ ok: false, error: 'Группа не найдена' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: group }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API GET /groups/[id] Error:', errorMessage);
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Неавторизован' }, { status: 401 });
    }

    const role = (session.user.role as string | undefined) || 'user';
    if (role !== 'coach' && role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Доступно только тренерам и администраторам' }, { status: 403 });
    }

    const url = new URL(req.url);
    const rawId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const groupId = toGroupThingId(rawId);

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const userId = toUserThingId(session.user.id.toString());
    const ok = await canAccessGroup(db, groupId, userId, role);
    if (!ok && role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Доступ запрещён' }, { status: 403 });
    }

    const body = (await req.json()) as UpdateGroupData;
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.description !== undefined) update.description = (body.description || '').trim();
    if (body.is_archived !== undefined) update.is_archived = !!body.is_archived;
    update.updated_at = 'time::now()';

    const result = await db.query(
      `UPDATE type::thing($table, $id) MERGE $update;`,
      { table: 'groups', id: rawId, update },
    );

    const group = (result[0] as unknown as Group[])?.[0];
    return NextResponse.json({ ok: true, data: group, message: 'Группа обновлена' }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API PATCH /groups/[id] Error:', errorMessage);
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Неавторизован' }, { status: 401 });
    }

    const role = (session.user.role as string | undefined) || 'user';
    if (role !== 'coach' && role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Доступно только тренерам и администраторам' }, { status: 403 });
    }

    const url = new URL(req.url);
    const rawId = decodeURIComponent(url.pathname.split('/').pop() || '');
    const groupId = toGroupThingId(rawId);

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const userId = toUserThingId(session.user.id.toString());
    const ok = await canAccessGroup(db, groupId, userId, role);
    if (!ok && role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Доступ запрещён' }, { status: 403 });
    }

    const result = await db.query(
      `UPDATE type::thing($table, $id) SET is_archived = true, updated_at = time::now();`,
      { table: 'groups', id: rawId },
    );
    const group = (result[0] as unknown as Group[])?.[0];

    return NextResponse.json({ ok: true, data: group, message: 'Группа архивирована' }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API DELETE /groups/[id] Error:', errorMessage);
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}

