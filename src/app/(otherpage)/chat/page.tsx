'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UIMessage } from 'ai';
import {
  Bot,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import styles from './ChatPage.module.scss';

type ChatRole = 'user' | 'assistant';

type StoredChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  created_at: string;
};

type ChatSession = {
  id: string;
  title: string;
  preview: string;
  messages: StoredChatMessage[];
  created_at: string;
  updated_at: string;
};

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const PROMPTS = [
  'С чего начать заниматься спортивным программированием?',
  'Какие соревнования скоро пройдут?',
  'Помоги разобрать задачу про массивы',
];

interface ChatMessageProps {
  role: ChatRole;
  text: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ role, text }) => {
  const isUser = role === 'user';

  return (
    <div className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`}>
      <div className={`${styles.iconWrapper} ${isUser ? styles.userIcon : styles.botIcon}`}>
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      <div className={`${styles.contentBubble} ${isUser ? styles.userContent : styles.assistantContent}`}>
        <p>{text}</p>
      </div>
    </div>
  );
};

function extractText(message: UIMessage) {
  return (
    message.parts
      ?.filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join(' ') ?? ''
  );
}

function toStoredMessages(messages: UIMessage[]): StoredChatMessage[] {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      id: message.id,
      role: message.role as ChatRole,
      text: extractText(message),
      created_at: new Date().toISOString(),
    }))
    .filter((message) => message.text.trim().length > 0);
}

function toUiMessages(messages: StoredChatMessage[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.text }],
  }));
}

function titleFromMessages(messages: UIMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const title = firstUserMessage ? extractText(firstUserMessage).trim().replace(/\s+/g, ' ') : '';
  return title ? title.slice(0, 72) : 'Новый чат';
}

function formatSessionDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<UIMessage[]>([]);
  const activeSessionIdRef = useRef<string | null>(null);
  const fullTextRef = useRef('');
  const displayedTextRef = useRef('');
  const displayedIndexRef = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await fetch('/api/chat/sessions');
      const data = (await res.json()) as ApiResponse<ChatSession[]>;
      if (!data.ok) throw new Error(data.error || 'Не удалось загрузить историю');

      const loadedSessions = data.data || [];
      setSessions(loadedSessions);

      if (!activeSessionIdRef.current && loadedSessions.length > 0) {
        const first = loadedSessions[0];
        setActiveSessionId(first.id);
        setMessages(toUiMessages(first.messages || []));
      }
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Не удалось загрузить историю');
    } finally {
      setHistoryLoading(false);
    }
  }

  function upsertSession(session: ChatSession) {
    setSessions((current) => {
      const withoutCurrent = current.filter((item) => item.id !== session.id);
      return [session, ...withoutCurrent].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    });
  }

  async function createSession(nextMessages: UIMessage[]) {
    const res = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titleFromMessages(nextMessages),
        messages: toStoredMessages(nextMessages),
      }),
    });

    const data = (await res.json()) as ApiResponse<ChatSession>;
    if (!data.ok || !data.data) {
      throw new Error(data.error || 'Не удалось создать чат');
    }

    upsertSession(data.data);
    setActiveSessionId(data.data.id);
    return data.data.id;
  }

  async function saveSession(sessionId: string, nextMessages: UIMessage[]) {
    const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titleFromMessages(nextMessages),
        messages: toStoredMessages(nextMessages),
      }),
    });

    const data = (await res.json()) as ApiResponse<ChatSession>;
    if (!data.ok || !data.data) {
      throw new Error(data.error || 'Не удалось сохранить чат');
    }

    upsertSession(data.data);
  }

  async function deleteSession(sessionId: string) {
    const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    const data = (await res.json()) as ApiResponse<null>;
    if (!data.ok) {
      setHistoryError(data.error || 'Не удалось удалить чат');
      return;
    }

    setSessions((current) => current.filter((session) => session.id !== sessionId));

    if (activeSessionIdRef.current === sessionId) {
      const nextSession = sessions.find((session) => session.id !== sessionId);
      setActiveSessionId(nextSession?.id ?? null);
      setMessages(nextSession ? toUiMessages(nextSession.messages) : []);
    }
  }

  function openHistoryChat(session: ChatSession) {
    if (isLoading) return;
    setActiveSessionId(session.id);
    setMessages(toUiMessages(session.messages || []));
    setInput('');
    setHistoryError(null);
  }

  function startNewChat() {
    if (isLoading) return;
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setHistoryError(null);
    inputRef.current?.focus();
  }

  function applyPrompt(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    setIsLoading(true);
    setHistoryError(null);

    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: trimmedInput }],
    };

    const nextMessages = [...messagesRef.current, userMessage];
    setMessages(nextMessages);
    setInput('');

    let sessionId = activeSessionIdRef.current;

    try {
      if (!sessionId) {
        sessionId = await createSession(nextMessages);
      } else {
        await saveSession(sessionId, nextMessages);
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
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

      let buffer = '';
      let isAnimating = false;

      const updateAssistantMessage = (text: string) => {
        setMessages((prev) => {
          const filtered = prev.filter((message) => message.id !== assistantId);
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
          setTimeout(typeNextCharacter, delay);
        } else {
          isAnimating = false;
        }
      };

      const startAnimation = () => {
        if (displayedIndexRef.current >= fullTextRef.current.length || isAnimating) return;
        isAnimating = true;
        typeNextCharacter();
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const line of parts) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;

          const data = trimmedLine.substring(5).trim();
          if (data === '[DONE]') break;

          try {
            const streamEvent = JSON.parse(data);
            const content = streamEvent.choices?.[0]?.delta?.content;
            if (content) {
              fullTextRef.current += content;
              startAnimation();
            }
          } catch {
            // Some providers send non-JSON keepalive chunks.
          }
        }
      }

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

      const assistantMessage: UIMessage = {
        id: assistantId,
        role: 'assistant',
        parts: [{ type: 'text', text: fullTextRef.current }],
      };
      const finalMessages = [...nextMessages, assistantMessage];
      setMessages(finalMessages);

      if (sessionId) {
        await saveSession(sessionId, finalMessages);
      }
    } catch (err) {
      console.error(err);

      const errorMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Не получилось получить ответ. Проверь подключение к API и попробуй еще раз.',
          },
        ],
      };
      const finalMessages = [...nextMessages, errorMessage];
      setMessages(finalMessages);

      if (sessionId) {
        await saveSession(sessionId, finalMessages).catch(() => {
          setHistoryError('Ответ не получен, чат сохранен локально только на экране.');
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className={styles.chatShell}>
      <aside className={styles.sidebar} aria-label="История чатов">
        <div className={styles.sidebarHeader}>
          <MessageSquare size={22} />
          <span>История чатов</span>
        </div>

        {historyError && <div className={styles.historyError}>{historyError}</div>}

        <div className={styles.historyList}>
          {historyLoading ? (
            <div className={styles.historyState}>Загрузка истории...</div>
          ) : sessions.length === 0 ? (
            <div className={styles.historyState}>Сохраненных чатов пока нет.</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`${styles.historyItem} ${
                  activeSessionId === session.id ? styles.activeHistoryItem : ''
                }`}
              >
                <button
                  type="button"
                  className={styles.historyOpenButton}
                  onClick={() => openHistoryChat(session)}
                  disabled={isLoading}
                >
                  <strong>{session.title}</strong>
                  <span>{session.preview || 'Без сообщений'}</span>
                  <small>{formatSessionDate(session.updated_at)}</small>
                </button>
                <button
                  type="button"
                  className={styles.historyDeleteButton}
                  onClick={() => deleteSession(session.id)}
                  disabled={isLoading}
                  aria-label={`Удалить чат ${session.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <button type="button" className={styles.newChatButton} onClick={startNewChat}>
          <Plus size={18} />
          Новый чат
        </button>
      </aside>

      <div className={styles.chatPanel}>
        <div className={styles.chatHeader}>
          <div>
            <p>ИИ-ассистент</p>
            <h1>Эко</h1>
          </div>
          <div className={styles.statusBadge}>
            <Sparkles size={16} />
            online
          </div>
        </div>

        <div className={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.ecoMark}>
                <Bot size={42} />
              </div>
              <h2>Привет! Я Эко</h2>
              <p>
                Задай вопрос по алгоритмам, ближайшим соревнованиям или материалам.
                Новый диалог сохранится автоматически после первого сообщения.
              </p>
              <div className={styles.promptGrid}>
                {PROMPTS.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => applyPrompt(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              if (message.role !== 'user' && message.role !== 'assistant') return null;

              return (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  text={extractText(message)}
                />
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputArea}>
          <form onSubmit={sendMessage} className={styles.form}>
            <input
              ref={inputRef}
              className={styles.inputField}
              value={input}
              placeholder={isLoading ? 'Эко пишет...' : 'Задайте ваш вопрос...'}
              onChange={(event) => setInput(event.target.value)}
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={styles.submitButton}
              aria-label="Отправить сообщение"
            >
              {isLoading ? (
                <Loader2 size={24} className={styles.spinner} />
              ) : (
                <Send size={24} />
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
