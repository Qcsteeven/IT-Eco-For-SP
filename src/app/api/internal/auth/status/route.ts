import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDB } from '@/lib/surreal/surreal';
import { parseUsersRecordKey } from '@/lib/surreal/ids';
import { isValidUserRole, type UserRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

type StatusResponse = {
  active: boolean;
  role?: UserRole;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<StatusResponse>(
        { active: false },
        { status: 200 },
      );
    }

    const db = await getDB();
    const key = parseUsersRecordKey(String(session.user.id));
    if (!db || !key) {
      return NextResponse.json<StatusResponse>(
        { active: false },
        { status: 200 },
      );
    }

    const res = await db.query(
      `SELECT role, is_verified, is_blocked
       FROM type::thing("users", $id)
       LIMIT 1;`,
      { id: key },
    );
    const rows = (Array.isArray(res) ? (res[0] as unknown[]) : []) || [];
    const row = (rows[0] as Record<string, unknown> | undefined) || undefined;
    const isBlocked = row?.is_blocked === true;
    const isVerified = row?.is_verified !== false;
    const role = String(row?.role || '');
    const active = !isBlocked && isVerified && isValidUserRole(role);

    return NextResponse.json<StatusResponse>(
      {
        active,
        ...(active ? { role: role as UserRole } : {}),
      },
      { status: 200 },
    );
  } catch {
    // Fail closed: если не можем проверить — считаем неактивным
    return NextResponse.json<StatusResponse>(
      { active: false },
      { status: 200 },
    );
  }
}
