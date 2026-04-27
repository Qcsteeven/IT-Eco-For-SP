import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';
import { authOptions } from '@/lib/authOptions';
import { toUserThingId } from '@/lib/surreal/ids';
import type { CreateGroupData, Group } from '@/lib/types/group';

// GET /api/groups
// - admin: все
// - coach: только свои (group_coaches)
// - user: только где состоит (group_members)
export const GET = async () => {
  try {
    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    // auth опциональна: если не авторизован — вернём пусто
    // (в проекте нет отдельного публичного сценария для групп)
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ ok: true, data: [] }, { status: 200 });
    }

    const userId = toUserThingId(session.user.id.toString());
    const role = (session.user.role as string | undefined) || 'user';

    let query = `SELECT * FROM groups WHERE is_archived != true`;
    const params: Record<string, unknown> = { userId };

    if (role === 'admin') {
      query += ` ORDER BY created_at DESC;`;
    } else if (role === 'coach') {
      query += ` AND id IN (SELECT VALUE group_id FROM group_coaches WHERE coach_id = type::thing($userId)) ORDER BY created_at DESC;`;
    } else {
      query += ` AND id IN (SELECT VALUE group_id FROM group_members WHERE user_id = type::thing($userId)) ORDER BY created_at DESC;`;
    }

    const result = await db.query<Group[][]>(query + ';', params);
    const groups = result[0] || [];
    return NextResponse.json({ ok: true, data: groups }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API GET /groups Error:', errorMessage);
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
};

// POST /api/groups (coach/admin)
export const POST = withRoleGuard(
  async (req, session) => {
    try {
      const body = (await req.json()) as CreateGroupData;
      if (!body?.name?.trim()) {
        return NextResponse.json(
          { ok: false, error: 'name обязателен' },
          { status: 400 },
        );
      }

      const db = await getDB();
      if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

      const createdByRaw = session.user.id.toString();
      const createdBy = toUserThingId(createdByRaw);

      const groupResult = await db.query(
        `CREATE groups CONTENT {
          name: $name,
          description: $description,
          is_archived: false,
          created_by: type::thing($createdBy),
          created_at: time::now(),
          updated_at: time::now()
        };`,
        {
          name: body.name.trim(),
          description: (body.description || '').trim(),
          createdBy,
        },
      );

      const createdGroup = (groupResult[0] as unknown as Group[])?.[0];
      if (!createdGroup?.id) {
        return NextResponse.json(
          { ok: false, error: 'Не удалось создать группу' },
          { status: 500 },
        );
      }

      // Автоматически добавляем создателя как owner в group_coaches
      await db.query(
        `CREATE group_coaches CONTENT {
          group_id: type::thing($groupId),
          coach_id: type::thing($coachId),
          role_in_group: 'owner',
          added_at: time::now()
        };`,
        {
          groupId: createdGroup.id,
          coachId: createdBy,
        },
      );

      return NextResponse.json(
        { ok: true, data: createdGroup, message: 'Группа создана' },
        { status: 201 },
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('API POST /groups Error:', errorMessage);
      return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
    }
  },
  { requiredRole: 'coach' },
);

