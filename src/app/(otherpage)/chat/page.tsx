// src/app/(otherpage)/chat/page.tsx
'use client';

import React, { useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { Send, User, Bot, Loader2 } from 'lucide-react';

// Импорт модульных стилей SCSS
import styles from './ChatPage.module.scss';

// --- Компонент UI для сообщения (без изменений) ---
interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
}

const ChatMessage: React.FC<MessageProps> = ({ role, content }) => {
  const isUser = role === 'user';
  const messageClass = isUser ? styles.userMessage : styles.assistantMessage;
  const iconWrapperClass = isUser ? styles.userIcon : styles.botIcon;
  const contentBubbleClass = isUser
    ? styles.userContent
    : styles.assistantContent;

  return (
    <div className={`${styles.message} ${messageClass}`}>
      <div className={`${styles.iconWrapper} ${iconWrapperClass}`}>
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>
      <div className={`${styles.contentBubble} ${contentBubbleClass}`}>
        <p>{content}</p>
      </div>
    </div>
  );
};

// --- Основной компонент страницы чата ---
const ChatPage: React.FC = () => {
  const {
    messages,
    input = '',
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  } = useChat({
    api: '/api/chat',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className={styles.chatContainer}>
      <header className={styles.header}>
        <h1>AI RAG Чат</h1>
      </header>

      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <Bot size={48} className="mb-4" />
            <p>Начните общение, задав вопрос...</p>
          </div>
        ) : (
          messages.map((m) => (
            <ChatMessage
              key={m.id}
              role={m.role === 'user' ? 'user' : 'assistant'}
              content={m.content || ''}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        {error && (
          <div className="text-red-500 mb-2 p-2 bg-red-50 border border-red-200 rounded">
            Ошибка: {(error as Error).message || 'Произошла ошибка.'}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.inputField}
            value={input}
            placeholder={isLoading ? 'AI пишет...' : 'Напишите сообщение...'}
            onChange={handleInputChange}
            // 🛑 ВРЕМЕННО ОТКЛЮЧЕНО: Удален disabled={isLoading}
            autoFocus
          />

          <button
            type="submit"
            // 🛑 ВРЕМЕННО ОТКЛЮЧЕНО: Установлено disabled={false} для проверки,
            // чтобы исключить ошибку, связанную с !input.trim()
            disabled={false}
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
};

export default ChatPage;
