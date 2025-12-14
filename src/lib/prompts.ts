// src/lib/prompts.ts

export type AgentRole = 'student' | 'organizer';

export interface PromptContext {
  ragContext: string;
  userMessage: string;
  agentRole: AgentRole;
  mode?: 'chat' | 'action'; // необязательный: явно указать режим
}

const ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  student: `
Ты — AI-агент для студентов в образовательной экосистеме.
Твоя задача — помогать находить учебные материалы, объяснять темы, напоминать о дедлайнах и поддерживать в выполнении практик.
`,
  organizer: `
Ты — AI-агент для организаторов образовательных событий.
Твоя задача — помогать создавать мероприятия, управлять задачами, формировать уведомления и взаимодействовать с участниками.
`
};

const INSTRUCTIONS_CHAT = `
Отвечай в формате Markdown:
- Кратко, ясно и дружелюбно.
- Используй списки, жирный шрифт или цитаты при необходимости.
- Ссылься на релевантные материалы из контекста.
- Не используй обёртки вроде \`\`\`markdown — только чистый Markdown.
`;

const INSTRUCTIONS_ACTION = `
Отвечай ТОЛЬКО валидным JSON, без каких-либо пояснений, комментариев или markdown-обёрток.
Структура зависит от запроса, но всегда должна быть валидной.
Примеры действий: создание события, напоминания, отправка формы, запрос подтверждения.
Все даты — в формате ISO 8601 (например: "2025-12-10T18:00:00Z").
`;

export function createSystemPrompt({
  ragContext,
  agentRole,
  mode = 'chat'
}: Omit<PromptContext, 'userMessage'>): string {
  const roleDesc = ROLE_DESCRIPTIONS[agentRole];
  const instructions = mode === 'action' ? INSTRUCTIONS_ACTION : INSTRUCTIONS_CHAT;

  const contextBlock = ragContext.trim()
    ? `**Релевантный контекст из базы знаний:**\n${ragContext}`
    : `**Контекст не найден.** Отвечай на основе общих знаний, но не выдумывай детали.`;

  return `
Ты — интеллектуальный ассистент в образовательной экосистеме.

${roleDesc}

${contextBlock}

**Правила генерации:**
${instructions}

**Запрещено:**
- Выдавать информацию, которой нет в контексте или в общих знаниях.
- Добавлять префиксы вроде "Ответ:" или "JSON:".
- Использовать обратные кавычки или markdown-блоки при генерации JSON.
`;
}