import { NextResponse } from 'next/server';

import { cronAuthErrorResponse } from '@/lib/internal/cron-auth';
import { syncCodeforcesKarmaForAllUsers } from '@/lib/codeforces/karma-service';

export const dynamic = 'force-dynamic';

/**
 * Внутренний эндпоинт синхронизации кармы Codeforces.
 * Вызывается Render Cron / фоновым воркером с Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const denied = cronAuthErrorResponse(request);
  if (denied) return denied;

  const result = await syncCodeforcesKarmaForAllUsers();
  return NextResponse.json(
    {
      ok: result.ok,
      data: result,
    },
    { status: result.ok ? 200 : 207 },
  );
}

export async function POST(request: Request) {
  return GET(request);
}
