import { NextResponse } from 'next/server';

import { syncCodeforcesCalendar } from '@/lib/jobs/sync-codeforces-calendar';
import { cronAuthErrorResponse } from '@/lib/internal/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * Внутренний эндпоинт синхронизации календаря Codeforces.
 * Вызывается Render Cron / фоновым воркером с Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const denied = cronAuthErrorResponse(request);
  if (denied) return denied;

  const result = await syncCodeforcesCalendar();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    data: {
      scanned: result.scanned,
      synced: result.synced,
      upserted: result.upserted,
      errors: result.errors,
      errorCount: result.errorCount,
    },
  });
}

export async function POST(request: Request) {
  return GET(request);
}
