import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { hashPassword } from '@/lib/surreal/auth';
import { Surreal } from 'surrealdb';
import { UserRole, getDefaultUserRole } from '@/lib/rbac';

interface RegistrationRequestBody {
  email: string;
  password: string;
  full_name: string;
}

interface UserRecord {
  email: string;
  password_hash: string;
  full_name: string;
  phone: string;
  is_verified: boolean;
  registration_date: Date;
  role: UserRole;

  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name }: RegistrationRequestBody =
      await request.json();
    const db: Surreal = await getDB();
    const normalizedEmail = email?.trim().toLowerCase();
    const fullName = full_name?.trim();

    if (!normalizedEmail || !password || !fullName) {
      return NextResponse.json(
        { message: 'Заполните все обязательные поля.' },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Пароль должен быть не короче 6 символов.' },
        { status: 400 },
      );
    }

    const queryResult: unknown = await db.query(
      'SELECT id FROM users WHERE email = $email',
      { email: normalizedEmail },
    );

    const existingUsersArray =
      queryResult && typeof queryResult === 'object' && '0' in queryResult
        ? (queryResult as Record<string, { result?: unknown[] }>)['0']
            ?.result || []
        : [];

    if (existingUsersArray.length > 0) {
      return NextResponse.json(
        {
          message: 'Пользователь с таким email уже существует.',
        },
        { status: 409 },
      );
    }

    const passwordHash: string = await hashPassword(password);

    const userRole: UserRole = getDefaultUserRole();

    const newUserRecord: UserRecord = {
      email: normalizedEmail,
      password_hash: passwordHash,
      full_name: fullName,
      phone: '',
      is_verified: false,
      registration_date: new Date(),
      role: userRole,
    };

    await db.create('users', newUserRecord);

    return NextResponse.json(
      {
        message:
          'Пользователь создан. Аккаунт ожидает подтверждения администратором.',
        email: normalizedEmail,
        requiresAdminApproval: true,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Ошибка регистрации API:', errorMessage);

    const isDuplicateError =
      errorMessage.includes('Database index `unique_email`') ||
      errorMessage.includes('constraint failed on table users');

    if (isDuplicateError) {
      return NextResponse.json(
        {
          message: 'Пользователь с таким email уже существует.',
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        message: 'Внутренняя ошибка сервера при регистрации.',
      },
      { status: 500 },
    );
  }
}
