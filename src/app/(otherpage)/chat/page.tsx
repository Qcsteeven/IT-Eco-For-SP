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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<UIMessage[]>([]);
  const fullTextRef = useRef('');
  const displayedTextRef = useRef('');
  const displayedIndexRef = useRef(0);

  // Синхронизируем ref с state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

    setIsLoading(true);

    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: input }],
    };

    const currentMessages = [...messagesRef.current];

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...currentMessages, userMessage],
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Stream failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      const assistantId = crypto.randomUUID();
      fullTextRef.current = '';
      displayedTextRef.current = '';
      displayedIndexRef.current = 0;

      // Буфер для сбора полных JSON строк
      let buffer = '';
      let isAnimating = false;

      const updateAssistantMessage = (text: string) => {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== assistantId);
          return [
            ...filtered,
            {
              id: assistantId,
              role: 'assistant',
              parts: [{ type: 'text', text }],
            },
          ];
        });
      };

      const typeNextCharacter = () => {
        const currentFull = fullTextRef.current;
        const currentIndex = displayedIndexRef.current;

        if (currentIndex < currentFull.length) {
          const nextChars = currentFull.slice(currentIndex, currentIndex + 2);
          displayedIndexRef.current = currentIndex + nextChars.length;
          displayedTextRef.current = currentFull.slice(0, displayedIndexRef.current);

          updateAssistantMessage(displayedTextRef.current);

          const delay = Math.max(15, 50 - currentIndex * 0.1);
          setTimeout(() => {
            typeNextCharacter();
          }, delay);
        } else {
          // Анимация завершена, но могут прийти новые данные
          isAnimating = false;
        }
      };

      // Запускает анимацию, если есть данные для отображения
      const startAnimation = () => {
        if (displayedIndexRef.current >= fullTextRef.current.length) {
          return; // Всё отображено
        }
        if (isAnimating) {
          return; // Анимация уже запущена
        }
        isAnimating = true;
        typeNextCharacter();
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Разделяем по двойным новым строкам (конец SSE сообщения)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || ''; // Оставляем незавершённую часть в буфере

        for (const line of parts) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;

          const data = trimmedLine.substring(5).trim();
          if (data === '[DONE]') break;

          try {
            const event = JSON.parse(data);
            const content = event.choices?.[0]?.delta?.content;
            if (content) {
              fullTextRef.current += content;
              startAnimation();
            }
          } catch {
            // Игнорируем некорректные строки
          }
        }
      }

      // Ждём завершения анимации
      await new Promise<void>((resolve) => {
        const checkComplete = () => {
          if (displayedTextRef.current.length >= fullTextRef.current.length) {
            resolve();
          } else {
            setTimeout(checkComplete, 30);
          }
        };
        checkComplete();
      });
    } catch (err) {
      console.error(err);
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
