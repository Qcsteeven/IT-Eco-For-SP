import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';
import { authOptions } from '@/lib/authOptions';
import { toUserThingId } from '@/lib/surreal/ids';
import type { CreateGroupData, Group } from '@/lib/types/group';

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

export const GET = async () => {
  try {
    const db = await getDB();
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных SurrealDB');
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: true, data: [] }, { status: 200 });
    }

    const userId = toUserThingId(session.user.id.toString());
    const role = (session.user.role as string | undefined) || 'user';
    const params: Record<string, unknown> = { userId };

    let query = `SELECT * FROM groups WHERE is_archived != true`;

    if (role === 'admin') {
      query += ` ORDER BY created_at DESC;`;
    } else if (role === 'coach') {
      query += `
        AND id IN (
          SELECT VALUE group_id
          FROM group_coaches
          WHERE coach_id = type::thing($userId)
        )
        ORDER BY created_at DESC;
      `;
    } else {
      query += `
        AND id IN (
          SELECT VALUE group_id
          FROM group_members
          WHERE user_id = type::thing($userId)
        )
        ORDER BY created_at DESC;
      `;
    }

    const result = await db.query<Group[]>(query, params);
    const groups = rowsFromQuery<Group & DbRow>(result);

    return NextResponse.json({ ok: true, data: groups }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API GET /groups Error:', errorMessage);
    return jsonError(errorMessage, 500);
  }
};

export const POST = withRoleGuard(
  async (req, session) => {
    try {
      const body = (await req.json()) as CreateGroupData;
      const name = body?.name?.trim();

      if (!name) {
        return jsonError('Название группы обязательно', 400);
      }

      const db = await getDB();
      if (!db) {
        throw new Error('Не удалось подключиться к базе данных SurrealDB');
      }

      const createdBy = toUserThingId(session.user.id.toString());
      const groupResult = await db.query<Group[]>(
        `CREATE groups CONTENT {
          name: $name,
          description: $description,
          is_archived: false,
          created_by: type::thing($createdBy),
          created_at: time::now(),
          updated_at: time::now()
        };`,
        {
          name,
          description: (body.description || '').trim(),
          createdBy,
        },
      );

      const createdGroup = rowsFromQuery<Group & DbRow>(groupResult)[0];
      if (!createdGroup?.id) {
        return jsonError('Не удалось создать группу', 500);
      }

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
      return jsonError(errorMessage, 500);
    }
  },
  { requiredRole: 'coach' },
);
