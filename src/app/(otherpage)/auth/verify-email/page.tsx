'use client';

import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// 1. ИМПОРТИРУЕМ СТИЛИ КАК МОДУЛЬ
import styles from './VerifyEmail.module.scss';

/**
 * Тип данных для ответа от API.
 */
interface ApiResponse {
  message: string;
}

/**
 * Безопасная функция для выполнения POST-запросов к API.
 */
const safeFetch = async (
  url: string,
  body: { email: string; code?: string },
): Promise<{ response: Response; data: ApiResponse }> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  let data: ApiResponse = { message: 'Внутренняя ошибка сервера.' };

  try {
    data = JSON.parse(responseText) as ApiResponse;
  } catch (e) {
    console.error(
      `Сервер вернул не JSON (HTTP ${response.status}):`,
      responseText.substring(0, 100) + '...',
    );
  }

  return { response, data };
};

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = searchParams?.get('email') || '';

  const [email, setEmail] = useState<string>(initialEmail);
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    setIsSuccess(false);

    if (!email || !code) {
      setMessage('Заполните оба поля.');
      setLoading(false);
      return;
    }

    try {
      const { response, data } = await safeFetch('/api/verify-email', {
        email,
        code,
      });

      if (response.ok) {
        setIsSuccess(true);
        setMessage(data.message || 'Верификация прошла успешно!');

        setTimeout(() => {
          router.push('/auth/signin');
        }, 3000);
      } else {
        setIsSuccess(false);

        setMessage(
          data.message ||
            `Ошибка: Сервер ответил со статусом ${response.status}.`,
        );
      }
    } catch (error) {
      setIsSuccess(false);
      setMessage('Сетевая ошибка. Проверьте ваше соединение.');
      console.error('Verification error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setMessage('');
    setLoading(true);
    setIsSuccess(false);

    if (!email) {
      setMessage('Пожалуйста, введите email, чтобы отправить код повторно.');
      setLoading(false);
      return;
    }

    try {
      const { response, data } = await safeFetch('/api/resend-code', { email });

      if (response.ok) {
        setMessage(data.message || 'Новый код успешно отправлен!');
        setCode('');
      } else {
        setMessage(
          data.message ||
            `Ошибка при повторной отправке кода: статус ${response.status}.`,
        );
      }
    } catch (error) {
      setMessage('Сетевая ошибка при запросе нового кода.');
      console.error('Resend code error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCode(value);
  };

  return (
    // 2. ИСПОЛЬЗУЕМ styles.className
    <div className={styles.verifyEmailContainer}>
      <h2 className={styles.title}>Подтверждение Email 📧</h2>
      <p className={styles.description}>
        Введите email и код, который вы получили на почту.
      </p>

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>
            Email:
          </label>
          <input
            id="email"
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading || isSuccess}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="code" className={styles.label}>
            Код подтверждения (6 цифр):
          </label>
          <input
            id="code"
            className={styles.input}
            type="text"
            value={code}
            onChange={handleCodeChange}
            maxLength={6}
            required
            disabled={loading || isSuccess}
          />
        </div>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={loading || isSuccess}
        >
          {loading && !isSuccess
            ? 'Проверка...'
            : isSuccess
              ? 'Аккаунт верифицирован!'
              : 'Подтвердить'}
        </button>
      </form>

      {message && (
        // Условный класс для сообщений об успехе/ошибке
        <p className={isSuccess ? styles.successMessage : styles.errorMessage}>
          {message}
        </p>
      )}

      {!isSuccess && (
        <div className={styles.resendCodeSection}>
          Не получили код?
          <button
            onClick={handleResendCode}
            className={styles.resendButton}
            disabled={loading || isSuccess}
          >
            {loading ? 'Отправляем...' : 'Отправить повторно'}
          </button>
        </div>
      )}
    </div>
  );
}
