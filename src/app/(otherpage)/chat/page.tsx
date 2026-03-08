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

    // Сохраняем текущие сообщения ДО обновления state
    const currentMessages = [...messagesRef.current];
    
    // Добавляем сообщение пользователя в state
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      console.log('[client] sending messages:', [...currentMessages, userMessage].map(m => ({ 
        role: m.role, 
        text: m.parts?.find(p => p.type === 'text')?.text?.slice(0, 30) 
      })));
      
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

      let assistantMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        parts: [],
      };

      let fullText = '';
      let displayedText = '';
      let typingQueue = '';
      let typingTimeout: NodeJS.Timeout | null = null;

      // Typing effect - посимвольное отображение
      const typeCharacter = () => {
        if (typingQueue.length > 0 && displayedText.length < fullText.length) {
          const charsToAdd = 2;
          const nextChars = typingQueue.slice(0, charsToAdd);
          typingQueue = typingQueue.slice(charsToAdd);
          displayedText += nextChars;
          
          assistantMessage.parts = [{ type: 'text', text: displayedText }];
          setMessages((prev) => {
            const filtered = prev.filter(m => m.id !== assistantMessage.id);
            return [...filtered, assistantMessage];
          });
          
          const delay = Math.max(15, 40 - displayedText.length * 0.3);
          typingTimeout = setTimeout(typeCharacter, delay);
        }
      };

      const addToTypingQueue = (text: string) => {
        fullText += text;
        typingQueue += text;
        
        if (!typingTimeout) {
          typeCharacter();
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Парсим SSE-формат: data: {...}
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data:')) continue;

          const data = line.substring(5).trim();
          if (data === '[DONE]') break;

          try {
            const event = JSON.parse(data);
            if (event.choices?.[0]?.delta?.content) {
              addToTypingQueue(event.choices[0].delta.content);
            }
          } catch (e) {
            // Игнорируем некорректные строки
          }
        }
      }

      // Ждём завершения печати
      if (typingTimeout) {
        await new Promise<void>((resolve) => {
          const checkComplete = () => {
            if (typingQueue.length === 0) {
              resolve();
            } else {
              setTimeout(checkComplete, 50);
            }
          };
          checkComplete();
        });
      }
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
