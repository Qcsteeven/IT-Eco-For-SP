import { NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';

export async function GET() {
  try {
    const db = await getDB();
    const contests = await db.query('SELECT * FROM contests ORDER BY start_time_utc ASC');

    return NextResponse.json(contests[0]);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch contests' }, { status: 500 });
  }
}