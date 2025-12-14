'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UIMessage } from 'ai';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import styles from './ChatPage.module.scss';

type ChatRole = 'user' | 'assistant';

interface ChatMessageProps {
  role: ChatRole;
  text: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ role, text }) => {
  const isUser = role === 'user';

  return (
    <div
      className={`${styles.message} ${
        isUser ? styles.userMessage : styles.assistantMessage
      }`}
    >
      <div
        className={`${styles.iconWrapper} ${
          isUser ? styles.userIcon : styles.botIcon
        }`}
      >
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      <div
        className={`${styles.contentBubble} ${
          isUser ? styles.userContent : styles.assistantContent
        }`}
      >
        <p>{text}</p>
      </div>
    </div>
  );
};

export default function ChatPage() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const extractText = (m: UIMessage) =>
    m.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join(' ') ?? '';

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: input }],
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Stream failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let assistantMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        parts: [],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;

          const data = line.replace(/^data:\s*/, '');

          if (data === '[DONE]') return;

          const event = JSON.parse(data);

          if (event.type === 'text-delta') {
            // Добавляем дельту к последнему текстовому part
            let lastPart = assistantMessage.parts?.[assistantMessage.parts.length - 1];

            if (!lastPart || lastPart.type !== 'text') {
              // Если parts пустой или последний не текст, создаем новый
              assistantMessage.parts = [
                ...(assistantMessage.parts ?? []),
                { type: 'text', text: event.delta },
              ];
            } else {
              // Иначе конкатенируем дельту к последнему текстовому part
              lastPart.text += event.delta;
            }

            // Обновляем state
            setMessages((prev) => [...prev.slice(0, -1), assistantMessage]);
          }

      }
    }
    } catch (err) {
      console.error(err);
      setError('Ошибка при получении ответа от AI');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.chatContainer}>
      <header className={styles.header}>
        <h1>AI RAG Чат</h1>
      </header>

      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <Bot size={48} />
            <p>Начните общение, задав вопрос...</p>
          </div>
        ) : (
          messages.map((m) =>
            m.role === 'system' ? null : (
              <ChatMessage
                key={m.id}
                role={m.role}
                text={extractText(m)}
              />
            )
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        {error && (
          <div className="text-red-500 mb-2 p-2 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}

        <form onSubmit={sendMessage} className={styles.form}>
          <input
            className={styles.inputField}
            value={input}
            placeholder={isLoading ? 'AI пишет...' : 'Напишите сообщение...'}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={styles.submitButton}
          >
            {isLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <Send size={24} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
