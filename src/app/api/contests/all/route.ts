import { NextResponse } from 'next/server';

/**
 * GET /api/contests/all — обратная совместимость.
 * Перенаправляет на основной эндпоинт /api/contests.
 *
 * TODO: После обновления всех клиентов (calendar, UpcomingEvents)
 * удалить этот файл и использовать напрямую /api/contests.
 */
export async function GET() {
  try {
    // Вызываем основной эндпоинт локально
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/contests`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch contests' },
        { status: response.status },
      );
    }

    const result = await response.json();
    // Возвращаем массив данных для обратной совместимости
    return NextResponse.json(result.data || []);
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch contests' },
      { status: 500 },
    );
  }
}