import { UIMessage } from 'ai';
import { createSystemPrompt } from '@/lib/prompts';
import { getRagContext } from '@/lib/rag';

export const maxDuration = 30;

// Отключаем кэширование для этого роута
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    // Извлекаем текст из последнего сообщения пользователя
    const userMessages = messages.filter((m) => m.role === 'user');
    const lastUserMessage = userMessages.pop();

    let userMessage = '';

    if (lastUserMessage?.parts) {
      for (const part of lastUserMessage.parts) {
        if (part.type === 'text') {
          userMessage += part.text;
        }
      }
    }

    const trimmedMessage = userMessage.trim();
    if (!trimmedMessage) {
      throw new Error('Empty user message after extracting from parts');
    }

    const agentRole = 'student';

    // RAG + промпт
    const ragContext = await getRagContext(userMessage);
    const mode = /json/i.test(userMessage) ? 'action' : 'chat';
    const systemPrompt = createSystemPrompt({ ragContext, agentRole, mode });

    // Конвертируем сообщения в простой формат для RouterAI
    interface MessagePart {
      type: string;
      text?: string;
      [key: string]: unknown;
    }

    const simpleMessages = messages.map(m => {
      const textParts = (m.parts as MessagePart[] | undefined)?.filter(p => p.type === 'text') || [];
      const text = textParts.map((p) => p.text || '').join('');
      return { role: m.role, content: text };
    });

    // Прямой запрос к RouterAI API
    const response = await fetch('https://routerai.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ROUTERAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen/qwen3-235b-a22b-2507',
        messages: [
          { role: 'system', content: systemPrompt },
          ...simpleMessages
        ],
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`RouterAI API error: ${response.status}`);
    }

    // Возвращаем стрим напрямую
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return new Response(JSON.stringify({ error: 'AI generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
