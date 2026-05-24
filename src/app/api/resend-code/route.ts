import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      message:
        'Повторная отправка кода временно отключена. Аккаунт подтверждает администратор.',
    },
    { status: 410 },
  );
}
