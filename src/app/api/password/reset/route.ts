import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { hashPassword } from '@/lib/surreal/auth';

type UserRow = {
  id: unknown;
  email?: string;
};

type TokenRow = {
  id: unknown;
  expires_at?: string;
};

function rowsFromQuery<T>(result: unknown): T[] {
  if (!Array.isArray(result) || result.length === 0) return [];

  const first = result[0] as unknown;
  if (Array.isArray(first)) return first as T[];

  if (first && typeof first === 'object' && Array.isArray((first as { result?: unknown }).result)) {
    return (first as { result: T[] }).result;
  }

  return result as T[];
}

function recordIdToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tb === 'string' && record.id != null) {
      return `${record.tb}:${String(record.id)}`;
    }
    if (record.id != null) return recordIdToString(record.id);
  }

  return String(value);
}

function recordKey(value: unknown, table: string): string {
  const raw = recordIdToString(value);
  const prefix = `${table}:`;
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(req: Request) {
  try {
    const { email, token, password } = (await req.json()) as {
      email?: string;
      token?: string;
      password?: string;
    };

    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedToken = token?.trim();

    if (!normalizedEmail || !normalizedToken || !password) {
      return NextResponse.json(
        { ok: false, message: 'Email, токен и новый пароль обязательны.' },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, message: 'Пароль должен быть не короче 6 символов.' },
        { status: 400 },
      );
    }

    const db = await getDB();
    const user = rowsFromQuery<UserRow>(
      await db.query(
        'SELECT id, email FROM users WHERE email = $email LIMIT 1',
        { email: normalizedEmail },
      ),
    )[0];

    if (!user) {
      return NextResponse.json(
        { ok: false, message: 'Ссылка восстановления недействительна.' },
        { status: 400 },
      );
    }

    const userKey = recordKey(user.id, 'users');
    const tokenHash = hashToken(normalizedToken);
    const resetToken = rowsFromQuery<TokenRow>(
      await db.query(
        `
          SELECT id, expires_at
          FROM password_reset_tokens
          WHERE user_id = type::thing("users", $userKey)
            AND token_hash = $tokenHash
          ORDER BY created_at DESC
          LIMIT 1
        `,
        { userKey, tokenHash },
      ),
    )[0];

    if (!resetToken) {
      return NextResponse.json(
        { ok: false, message: 'Ссылка восстановления недействительна.' },
        { status: 400 },
      );
    }

    const expiresAt = resetToken.expires_at ? new Date(resetToken.expires_at) : null;
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      await db.query(
        'DELETE password_reset_tokens WHERE user_id = type::thing("users", $userKey) AND token_hash = $tokenHash',
        { userKey, tokenHash },
      );

      return NextResponse.json(
        { ok: false, message: 'Срок действия ссылки истек. Запросите восстановление заново.' },
        { status: 400 },
      );
    }

    await db.query(
      `
        UPDATE type::thing("users", $userKey) SET
          password_hash = $passwordHash
      `,
      { userKey, passwordHash: await hashPassword(password) },
    );

    await db.query(
      'DELETE password_reset_tokens WHERE user_id = type::thing("users", $userKey)',
      { userKey },
    );

    return NextResponse.json({
      ok: true,
      message: 'Пароль обновлен. Теперь можно войти.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Password/Reset] Failed to reset password:', errorMessage);
    return NextResponse.json(
      { ok: false, message: 'Не удалось обновить пароль.' },
      { status: 500 },
    );
  }
}
