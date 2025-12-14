import { fireworks } from '@ai-sdk/fireworks';
import { streamText, UIMessage, convertToModelMessages } from 'ai';
// Убедитесь, что эти пути и функции существуют в вашем проекте
import { createSystemPrompt } from '@/lib/prompts';
import { getRagContext } from '@/lib/rag';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    // Извлекаем текст из последнего сообщения пользователя
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const lastUserMessage = userMessages.pop();

    let userMessage = '';

    if (lastUserMessage?.parts) {
      // Собираем все текстовые части
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

    // 🔸 ВРЕМЕННО: фиксированная роль (заменить на данные пользователя позже)
    const agentRole = 'student'; // или 'organizer'

    // RAG + промпт
    const ragContext = await getRagContext(userMessage);
    const mode = /json/i.test(userMessage) ? 'action' : 'chat';
    const systemPrompt = createSystemPrompt({ ragContext, agentRole, mode });

    // Генерация
    const result = streamText({
      model: fireworks('accounts/fireworks/models/gpt-oss-20b'),
      messages: convertToModelMessages(messages),
      system: systemPrompt,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('AI chat error:', error);
    return new Response(JSON.stringify({ error: 'AI generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
