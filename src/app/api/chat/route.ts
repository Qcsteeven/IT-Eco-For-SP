import { UIMessage } from 'ai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  AgentRole,
  createSystemPrompt,
  mapRBACRoleToAgentRole,
} from '@/lib/prompts';
import { getRagContext } from '@/lib/rag';
import { UserRole } from '@/lib/rbac';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

interface MessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

function extractUserText(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === 'user');
  const lastUserMessage = userMessages.pop();

  return (
    lastUserMessage?.parts
      ?.filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('') ?? ''
  );
}

function toSimpleMessages(messages: UIMessage[]) {
  return messages.map((message) => {
    const textParts =
      (message.parts as MessagePart[] | undefined)?.filter(
        (part) => part.type === 'text',
      ) || [];
    const content = textParts.map((part) => part.text || '').join('');

    return { role: message.role, content };
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => null)) as {
      messages?: UIMessage[];
    } | null;
    const messages = body?.messages;

    if (!Array.isArray(messages)) {
      return Response.json(
        { ok: false, error: 'Некорректный формат сообщений' },
        { status: 400 },
      );
    }

    const userMessage = extractUserText(messages);
    const trimmedMessage = userMessage.trim();

    if (!trimmedMessage) {
      return Response.json(
        { ok: false, error: 'Сообщение не должно быть пустым' },
        { status: 400 },
      );
    }

    const userRole = (session.user.role || 'student') as UserRole;
    const agentRole: AgentRole = mapRBACRoleToAgentRole(userRole);
    const ragContext = await getRagContext(trimmedMessage, {
      userId: session.user.id,
      role: userRole,
    });
    const mode = /json/i.test(trimmedMessage) ? 'action' : 'chat';
    const systemPrompt = createSystemPrompt({ ragContext, agentRole, mode });

    const response = await fetch(
      'https://routerai.ru/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ROUTERAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'qwen/qwen3-235b-a22b-2507',
          messages: [
            { role: 'system', content: systemPrompt },
            ...toSimpleMessages(messages),
          ],
          stream: true,
        }),
      },
    );

    if (!response.ok || !response.body) {
      throw new Error(`RouterAI API error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return Response.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
