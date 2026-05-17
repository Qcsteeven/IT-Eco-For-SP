import { NextRequest, NextResponse } from 'next/server';
import { listCalendarEvents } from '@/lib/calendar/events';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const events = await listCalendarEvents({
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    includeCodeforces: searchParams.get('includeCodeforces') !== 'false',
    includeContests: searchParams.get('includeContests') !== 'false',
    includeEvents: searchParams.get('includeEvents') !== 'false',
  });

  return NextResponse.json(events);
}
