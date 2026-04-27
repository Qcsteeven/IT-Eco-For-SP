import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDB } from '@/lib/surreal/surreal';
import { toGroupThingId, toUserThingId } from '@/lib/surreal/ids';

function toRecordIdString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const anyV = v as Record<string, unknown>;
    // Surreal может вернуть record целиком (FETCH), где id = thing-объект
    if (typeof anyV.id === 'string') return anyV.id;
    if (anyV.id && typeof anyV.id === 'object') {
      const inner = anyV.id as Record<string, unknown>;
      if (typeof inner.tb === 'string' && inner.id != null) return `${inner.tb}:${String(inner.id)}`;
      if (typeof inner.id === 'string') return inner.id;
    }
    // Или вернуть сам thing-объект { tb, id }
    if (typeof anyV.tb === 'string' && anyV.id != null) return `${anyV.tb}:${String(anyV.id)}`;
  }
  return String(v);
}

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
    const rawId = decodeURIComponent(url.pathname.split('/')[3] || '');
    const groupId = toGroupThingId(rawId);

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const userId = toUserThingId(session.user.id.toString());
    const role = (session.user.role as string | undefined) || 'user';

    const ok = await canAccessGroup(db, groupId, userId, role);
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'Доступ запрещён' }, { status: 403 });
    }

    const result = await db.query(
      `SELECT
        user_id,
        user_id.full_name AS full_name,
        user_id.email AS email,
        joined_at
      FROM group_members
      WHERE group_id = type::thing($groupId)
      ORDER BY joined_at DESC
      FETCH user_id;`,
      { groupId },
    );

    const membersRaw = (result[0] as Record<string, unknown>[]) || [];
    const members = membersRaw.map((m) => ({
      ...m,
      user_id: toRecordIdString(m.user_id),
    }));
    return NextResponse.json({ ok: true, data: members }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API GET /groups/[id]/members Error:', errorMessage);
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const rawId = decodeURIComponent(url.pathname.split('/')[3] || '');
    const groupId = toGroupThingId(rawId);

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const userId = toUserThingId(session.user.id.toString());
    const ok = await canAccessGroup(db, groupId, userId, role);
    if (!ok && role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Доступ запрещён' }, { status: 403 });
    }

    const body = (await req.json()) as { user_ids?: string[] };
    const userIds = (body.user_ids || []).map(toUserThingId).filter(Boolean);
    if (userIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'user_ids обязателен' }, { status: 400 });
    }

    let added = 0;
    const gid = groupId;
    for (const uid of userIds) {
      const existsRes = await db.query(
        `SELECT count() AS c FROM group_members WHERE group_id = type::thing($groupId) AND user_id = type::thing($userId);`,
        { groupId: gid, userId: uid },
      );
      const c = (existsRes[0] as Record<string, unknown>[])?.[0]?.c;
      const exists = typeof c === 'number' ? c > 0 : Number(c) > 0;
      if (exists) continue;

      await db.query(
        `CREATE group_members CONTENT { group_id: type::thing($groupId), user_id: type::thing($userId), joined_at: time::now() };`,
        { groupId: gid, userId: uid },
      );
      added += 1;
    }

    return NextResponse.json({ ok: true, message: 'Участники добавлены', added }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API POST /groups/[id]/members Error:', errorMessage);
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
    const rawId = decodeURIComponent(url.pathname.split('/')[3] || '');
    const groupId = toGroupThingId(rawId);

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const actingUserId = toUserThingId(session.user.id.toString());
    const ok = await canAccessGroup(db, groupId, actingUserId, role);
    if (!ok && role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Доступ запрещён' }, { status: 403 });
    }

    const body = (await req.json()) as { user_id?: string };
    const userId = toUserThingId(body.user_id || '');
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'user_id обязателен' }, { status: 400 });
    }

    await db.query(
      `DELETE group_members WHERE group_id = type::thing($groupId) AND user_id = type::thing($userId);`,
      { groupId, userId },
    );

    return NextResponse.json({ ok: true, message: 'Участник удалён' }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API DELETE /groups/[id]/members Error:', errorMessage);
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}

