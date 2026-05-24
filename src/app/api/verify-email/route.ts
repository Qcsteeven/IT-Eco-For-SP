import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      message:
        'Подтверждение по email временно отключено. Аккаунт подтверждает администратор.',
    },
    { status: 410 },
  );
}
