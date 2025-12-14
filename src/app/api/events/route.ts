import { NextResponse } from 'next/server';

import { getDB } from '@/lib/surreal/surreal';

type Contest = {
  id: string;
  title: string;
  platform: string;
  status: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link: string;
  platform_contest_id: string;
};

export async function GET() {
  try {
    const db = await getDB();

    if (!db) {
      throw new Error('Не удалось подключиться к базе данных SurrealDB');
    }

    const result = await db.query<Contest[][]>(
      'SELECT * FROM contests ORDER BY start_time_utc ASC;',
    );

    const contests = result[0];

    return NextResponse.json({ ok: true, data: contests }, { status: 200 });
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
