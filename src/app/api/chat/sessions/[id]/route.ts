import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDB } from '@/lib/surreal/surreal';

type ChatRole = 'user' | 'assistant';

type StoredChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  created_at: string;
};

type ChatSessionRow = Record<string, unknown>;

interface UpdateSessionBody {
  title?: string;
  messages?: StoredChatMessage[];
}

function rowsFromQuery(result: unknown): ChatSessionRow[] {
  if (!Array.isArray(result) || result.length === 0) return [];

  const first = result[0] as unknown;
  if (Array.isArray(first)) {
    return first.filter((row): row is ChatSessionRow => typeof row === 'object' && row !== null);
  }

  if (first && typeof first === 'object' && Array.isArray((first as { result?: unknown }).result)) {
    return ((first as { result: unknown[] }).result).filter(
      (row): row is ChatSessionRow => typeof row === 'object' && row !== null,
    );
  }

  return result.filter((row): row is ChatSessionRow => typeof row === 'object' && row !== null);
}

function recordIdToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function recordKey(value: unknown, table: string): string {
  const raw = recordIdToString(value);
  const prefix = `${table}:`;
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
}

function getSessionId(req: Request): string {
  const url = new URL(req.url);
  const marker = '/api/chat/sessions/';
  return decodeURIComponent(url.pathname.split(marker)[1] || '');
}

function sanitizeMessages(messages: unknown): StoredChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message): message is Record<string, unknown> => typeof message === 'object' && message !== null)
    .map((message) => ({
      id: String(message.id || crypto.randomUUID()),
      role: (message.role === 'assistant' ? 'assistant' : 'user') as ChatRole,
      text: String(message.text || ''),
      created_at: String(message.created_at || new Date().toISOString()),
    }))
    .filter((message) => message.text.trim().length > 0);
}

function serializeSession(row: ChatSessionRow) {
  const messages = sanitizeMessages(row.messages);
  const lastMessage = messages[messages.length - 1];

  return {
    id: recordIdToString(row.id),
    title: String(row.title || 'Новый чат'),
    messages,
    preview: lastMessage?.text ?? '',
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || row.created_at || ''),
  };
}

function getTitle(rawTitle: unknown, messages: StoredChatMessage[]): string {
  const title = String(rawTitle || '').trim();
  if (title) return title.slice(0, 72);

  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage) return 'Новый чат';

  return firstUserMessage.text.trim().replace(/\s+/g, ' ').slice(0, 72) || 'Новый чат';
}

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ? String(session.user.id) : null;
}

async function getOwnedSession(sessionId: string, userId: string) {
  const db = await getDB();
  const sessionKey = recordKey(sessionId, 'chat_sessions');
  const userKey = recordKey(userId, 'users');
  const result = await db.query(
    `
      SELECT id, title, messages, created_at, updated_at
      FROM type::thing("chat_sessions", $sessionKey)
      WHERE user_id = type::thing("users", $userKey)
      LIMIT 1
    `,
    { sessionKey, userKey },
  );

  return rowsFromQuery(result)[0] ?? null;
}

export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const sessionId = getSessionId(req);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'ID чата не указан' },
        { status: 400 },
      );
    }

    const row = await getOwnedSession(sessionId, userId);
    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'Чат не найден' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data: serializeSession(row) });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Chat/Sessions] Failed to load session:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Не удалось загрузить чат' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await getUserId();
    const sessionId = getSessionId(req);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'ID чата не указан' },
        { status: 400 },
      );
    }

    const body = (await req.json()) as UpdateSessionBody;
    const messages = sanitizeMessages(body.messages);
    const title = getTitle(body.title, messages);
    const now = new Date().toISOString();
    const db = await getDB();
    const sessionKey = recordKey(sessionId, 'chat_sessions');
    const userKey = recordKey(userId, 'users');

    const result = await db.query(
      `
        UPDATE type::thing("chat_sessions", $sessionKey) SET
          title = $title,
          messages = $messages,
          updated_at = $now
        WHERE user_id = type::thing("users", $userKey)
      `,
      { sessionKey, userKey, title, messages, now },
    );

    const updated = rowsFromQuery(result)[0] ?? null;
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'Чат не найден' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data: serializeSession(updated) });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Chat/Sessions] Failed to update session:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Не удалось сохранить чат' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getUserId();
    const sessionId = getSessionId(req);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'ID чата не указан' },
        { status: 400 },
      );
    }

    const existing = await getOwnedSession(sessionId, userId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Чат не найден' },
        { status: 404 },
      );
    }

    const db = await getDB();
    const sessionKey = recordKey(sessionId, 'chat_sessions');
    await db.query('DELETE type::thing("chat_sessions", $sessionKey)', { sessionKey });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Chat/Sessions] Failed to delete session:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Не удалось удалить чат' },
      { status: 500 },
    );
  }
}
