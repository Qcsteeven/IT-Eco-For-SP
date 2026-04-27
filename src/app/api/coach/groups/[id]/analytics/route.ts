import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';
import { toGroupThingId, toUserThingId } from '@/lib/surreal/ids';

function toRecordIdString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const anyV = v as Record<string, unknown>;
    if (typeof anyV.id === 'string') return anyV.id;
    if (typeof anyV.tb === 'string' && anyV.id != null) return `${anyV.tb}:${String(anyV.id)}`;
  }
  return String(v);
}

function toRawUserId(id: string): string {
  if (!id) return '';
  return id.startsWith('users:') ? id.slice('users:'.length) : id;
}

function lastResult<T>(res: unknown): T {
  if (!Array.isArray(res) || res.length === 0) return [] as unknown as T;
  return res[res.length - 1] as T;
}

export const GET = withRoleGuard(
  async (req: NextRequest, session) => {
    try {
      const rawId = req.nextUrl.pathname.split('/')[4] || '';
      const groupId = toGroupThingId(rawId);

      const db = await getDB();
      if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

      const role = (session.user.role as string | undefined) || 'user';
      const coachId = toUserThingId(session.user.id.toString());

      if (role !== 'admin') {
        const accessRes = await db.query(
          `SELECT * FROM group_coaches WHERE group_id = type::thing($groupId) AND coach_id = type::thing($coachId) LIMIT 1;`,
          { groupId, coachId },
        );
        const hasAccess = ((accessRes[0] as unknown as unknown[]) || []).length > 0;
        if (!hasAccess) {
          return NextResponse.json({ ok: false, error: 'Доступ запрещён' }, { status: 403 });
        }
      }

      const from = req.nextUrl.searchParams.get('from');
      const to = req.nextUrl.searchParams.get('to');
      const fromDt = from ? new Date(from).toISOString() : null;
      const toDt = to ? new Date(to).toISOString() : null;

      const membersRes = await db.query(
        `SELECT VALUE user_id FROM group_members WHERE group_id = type::thing($groupId) AND user_id != NONE;`,
        { groupId },
      );
      const memberIdsAll = (membersRes[0] as unknown as unknown[]) || [];
      const memberIds = Array.from(new Set(memberIdsAll.map(toRecordIdString).filter(Boolean)));
      const rawUserIds = memberIds.map(toRawUserId).filter(Boolean);

      let avg_bscp_rating: number | null = null;
      if (rawUserIds.length > 0) {
        const usersRes = await db.query(
          `
          SELECT bscp_rating
          FROM users
          WHERE id IN array::map($rawUserIds, |$id| type::thing('users', $id));
          `,
          { rawUserIds },
        );
        const rows = (lastResult<unknown[]>(usersRes) as unknown[]) || [];
        const ratings = rows
          .map((row) => {
            if (!row || typeof row !== 'object') return NaN;
            const r = (row as Record<string, unknown>).bscp_rating;
            return typeof r === 'number' ? r : Number(r);
          })
          .filter((v) => Number.isFinite(v));
        if (ratings.length > 0) {
          avg_bscp_rating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        }
      }

      // platforms distribution (same approach as before)
      let codeforces = 0;
      let atcoder = 0;
      let both = 0;
      let none = 0;
      if (rawUserIds.length > 0) {
        const distRes = await db.query(
          `
          LET $m = array::map($rawUserIds, |$id| type::thing('users', $id));
          LET $cf = (SELECT VALUE user_id FROM external_accounts WHERE platform_name = 'codeforces' AND is_verified = true AND user_id IN $m);
          LET $ac = (SELECT VALUE user_id FROM external_accounts WHERE platform_name = 'atcoder' AND is_verified = true AND user_id IN $m);
          LET $both = array::intersect($cf, $ac);
          LET $cfOnly = array::difference($cf, $both);
          LET $acOnly = array::difference($ac, $both);
          LET $any = array::union($cf, $ac);
          RETURN [ array::len($cfOnly), array::len($acOnly), array::len($both), array::len(array::difference($m, $any)) ];
          `,
          { rawUserIds },
        );
        const arr = (lastResult<number[]>(distRes) as unknown as number[]) || [];
        codeforces = Number(arr[0] || 0);
        atcoder = Number(arr[1] || 0);
        both = Number(arr[2] || 0);
        none = Number(arr[3] || 0);
      }

      // events stats
      const totalRes = await db.query(
        `SELECT count() AS c FROM events WHERE visibility_type = 'private' AND $groupId IN (target_groups ?? []);`,
        { groupId },
      );
      const completedRes = await db.query(
        `SELECT count() AS c FROM events WHERE visibility_type = 'private' AND status = 'completed' AND $groupId IN (target_groups ?? []);`,
        { groupId },
      );
      let inPeriod: number | null = null;
      if (fromDt && toDt) {
        const inPeriodRes = await db.query(
          `SELECT count() AS c
           FROM events
           WHERE visibility_type = 'private'
             AND $groupId IN (target_groups ?? [])
             AND start_time_utc >= time::parse($from)
             AND end_time_utc <= time::parse($to);`,
          { groupId, from: fromDt, to: toDt },
        );
        inPeriod = (inPeriodRes[0] as Record<string, unknown>[])?.[0]?.c as number ?? 0;
      }
      const total = (totalRes[0] as Record<string, unknown>[])?.[0]?.c as number ?? 0;
      const completed = (completedRes[0] as Record<string, unknown>[])?.[0]?.c as number ?? 0;

      return NextResponse.json(
        {
          ok: true,
          data: {
            members_count: memberIds.length,
            avg_bscp_rating,
            platform_distribution: { codeforces, atcoder, both, none },
            events: { total, completed, in_period: inPeriod },
          },
        },
        { status: 200 },
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('API GET /coach/groups/[id]/analytics Error:', errorMessage);
      return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
    }
  },
  { requiredRole: 'coach' },
);

