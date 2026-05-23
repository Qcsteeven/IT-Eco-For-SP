'use client';

import React, { useState, FormEvent, ChangeEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
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
  } catch {
    console.error(
      `Сервер вернул не JSON (HTTP ${response.status}):`,
      responseText.substring(0, 100) + '...',
    );
  }

  return { response, data };
};

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = searchParams?.get('email') || '';

  const [email] = useState<string>(initialEmail);
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

  const handleCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCode(value);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardLogo} aria-hidden="true">
          <Image
            src="/home-assets/hero/logo-full.png"
            alt=""
            width={354}
            height={236}
            priority
          />
        </div>

        <div className={styles.head}>
          <h2 className={styles.title}>Подтвердите адрес электронной почты</h2>
          <p className={styles.description}>
            На почту{' '}
            <a className={styles.emailLink} href={`mailto:${email}`}>
              {email || 'example@mail.com'}
            </a>{' '}
            отправлен код подтверждения. Скопируйте его и введите в поле ниже:
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="code" className={styles.srOnly}>
              Код подтверждения
            </label>
            <input
              id="code"
              className={styles.input}
              type="text"
              value={code}
              onChange={handleCodeChange}
              placeholder="Код подтверждения"
              maxLength={6}
              required
              disabled={loading || isSuccess}
              inputMode="numeric"
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
                : 'Отправить'}
          </button>
        </form>

        {message && (
          <p className={isSuccess ? styles.successMessage : styles.errorMessage}>
            {message}
          </p>
        )}

        {!isSuccess && (
          <div className={styles.linksRow}>
            <Link href="/auth/forgot-password" className={styles.linkBtn}>
              Забыли пароль?
            </Link>
            <Link href="/auth/signup" className={styles.linkBtn}>
              Регистрация
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className={styles.page}>Загрузка...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
