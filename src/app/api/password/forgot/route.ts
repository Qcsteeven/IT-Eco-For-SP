import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { sendEmail } from '@/lib/email/sendEmail';

type UserRow = {
  id: unknown;
  email?: string;
  full_name?: string;
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

function getOrigin(req: Request) {
  const configuredUrl = process.env.NEXTAUTH_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json(
        { ok: false, message: 'Email обязателен.' },
        { status: 400 },
      );
    }

    const db = await getDB();
    const user = rowsFromQuery<UserRow>(
      await db.query(
        'SELECT id, email, full_name FROM users WHERE email = $email LIMIT 1',
        { email: normalizedEmail },
      ),
    )[0];

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(token);
      const userKey = recordKey(user.id, 'users');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await db.query(
        'DELETE password_reset_tokens WHERE user_id = type::thing("users", $userKey)',
        { userKey },
      );

      await db.query(
        `
          CREATE password_reset_tokens SET
            user_id = type::thing("users", $userKey),
            token_hash = $tokenHash,
            expires_at = $expiresAt,
            created_at = time::now()
        `,
        { userKey, tokenHash, expiresAt },
      );

      const resetUrl = new URL('/auth/reset-password', getOrigin(req));
      resetUrl.searchParams.set('email', normalizedEmail);
      resetUrl.searchParams.set('token', token);

      const userName = user.full_name || 'пользователь';
      await sendEmail(
        normalizedEmail,
        'Восстановление пароля IT-Eco-For-SP',
        `Здравствуйте, ${userName}! Для смены пароля перейдите по ссылке: ${resetUrl.toString()}`,
        `
          <p>Здравствуйте, ${userName}!</p>
          <p>Вы запросили восстановление пароля в IT-Eco-For-SP.</p>
          <p><a href="${resetUrl.toString()}">Сменить пароль</a></p>
          <p>Ссылка действует 1 час. Если вы не запрашивали восстановление, просто проигнорируйте письмо.</p>
        `,
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Если такой email зарегистрирован, мы отправили ссылку для восстановления пароля.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Password/Forgot] Failed to request password reset:', errorMessage);
    return NextResponse.json(
      { ok: false, message: 'Не удалось отправить письмо для восстановления.' },
      { status: 500 },
    );
  }
}
