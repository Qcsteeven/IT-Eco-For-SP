// src/app/api/events/route.ts
import { NextResponse } from 'next/server';
// Убедитесь, что этот импорт правильный:
// import { getDB } from "@/lib/surreal/surreal";

export async function GET() {
  try {
    // Проверка, что getDB() существует и возвращает объект с методом query
    // const db = await getDB();

    // Временно заменил на заглушку для примера:
    const mockEvents = [
      {
        id: 'event:1',
        title: 'Weekly Contest 479',
        platform: 'LeetCode',
        status: 'Регистрация открыта',
        start_date: '2025-12-07T02:30:00Z',
        end_date: '2025-12-07T04:00:00Z',
        registration_link: 'https://leetcode.com/contest/479',
      },
      {
        id: 'event:2',
        title: 'Monthly Challenge',
        platform: 'Codeforces',
        status: 'Идет',
        start_date: '2025-12-10T15:00:00Z',
        end_date: '2025-12-10T17:00:00Z',
        registration_link: 'https://codeforces.com/contest/1000',
      },
    ];

    // Предполагаемый оригинальный код:
    // const events = await db.query("SELECT * FROM event;");
    // const allEvents = (events ?? []).filter(Boolean);
    // return NextResponse.json({ ok: true, data: allEvents }, { status: 200 });

    // Используем заглушку для демонстрации:
    return NextResponse.json({ ok: true, data: mockEvents }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
