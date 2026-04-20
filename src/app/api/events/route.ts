import { NextResponse } from 'next/server';

/**
 * GET /api/events — обратная совместимость.
 * Перенаправляет на основной эндпоинт /api/contests.
 *
 * TODO: После обновления всех клиентов (UpcomingEvents)
 * удалить этот файл и использовать напрямую /api/contests.
 */
export async function GET() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/contests`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[API /events GET] Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 },
    );
  }
}
