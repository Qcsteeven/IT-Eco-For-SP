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

interface CreateSessionBody {
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

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    const db = await getDB();
    const userKey = recordKey(userId, 'users');
    const result = await db.query(
      `
        SELECT id, title, messages, created_at, updated_at
        FROM chat_sessions
        WHERE user_id = type::thing("users", $userKey)
        ORDER BY updated_at DESC
      `,
      { userKey },
    );

    return NextResponse.json({
      ok: true,
      data: rowsFromQuery(result).map(serializeSession),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Chat/Sessions] Failed to load sessions:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Не удалось загрузить историю чатов' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    const body = (await req.json()) as CreateSessionBody;
    const messages = sanitizeMessages(body.messages);
    const title = getTitle(body.title, messages);
    const now = new Date().toISOString();

    const db = await getDB();
    const userKey = recordKey(userId, 'users');
    const created = await db.query(
      `
        CREATE chat_sessions SET
          user_id = type::thing("users", $userKey),
          title = $title,
          messages = $messages,
          created_at = $now,
          updated_at = $now
      `,
      { userKey, title, messages, now },
    );

    const createdRow = rowsFromQuery(created)[0];

    if (!createdRow || typeof createdRow !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Не удалось создать чат' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data: serializeSession(createdRow) }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Chat/Sessions] Failed to create session:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Не удалось создать чат' },
      { status: 500 },
    );
  }
}
