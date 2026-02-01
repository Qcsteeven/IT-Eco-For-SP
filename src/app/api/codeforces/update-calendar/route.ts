import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import axios from 'axios';

export async function GET(req: NextRequest) {
  try {
    const cfUrl = 'https://codeforces.com/api/contest.list';
    const response = await axios.get(cfUrl);

    if (response.data.status !== 'OK') {
      return NextResponse.json({ error: 'CF API Error' }, { status: 502 });
    }

    const upcomingContests = response.data.result.filter(
      (contest: any) => contest.phase === 'BEFORE',
    );

    const db = await getDB();

    for (const contest of upcomingContests) {
      const recordId = `contests:cf_${contest.id}`;

      const startTime = new Date(contest.startTimeSeconds * 1000).toISOString();
      const endTime = new Date(
        (contest.startTimeSeconds + contest.durationSeconds) * 1000,
      ).toISOString();

      // Мы используем MERGE, чтобы обновить только указанные поля
      // Если Surreal жалуется на 'title', значит в схеме оно обязательное.
      await db.query(
        `
        UPSERT type::thing($id) CONTENT {
            platform: 'Codeforces',
            platform_contest_id: $pc_id,
            name: $name,
            title: $name, -- Добавляем title, если БД его требует
            start_time_utc: type::datetime($start),
            end_time_utc: type::datetime($end),
            registration_link: $link,
            updated_at: time::now()
        };
        `,
        {
          id: recordId,
          pc_id: contest.id.toString(),
          name: contest.name || 'Untitled Contest', // Защита от NONE
          start: startTime,
          end: endTime,
          link: `https://codeforces.com/contests/${contest.id}`,
        },
      );
    }

    return NextResponse.json({
      success: true,
      processed: upcomingContests.length,
    });
  } catch (error: any) {
    console.error('Update Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
