'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { signIn, useSession, LiteralUnion } from 'next-auth/react';
import { BuiltInProviderType } from 'next-auth/providers/index';
import { useRouter, useSearchParams } from 'next/navigation';
// Импортируем модульные SCSS стили
import styles from './SignIn.module.scss';

// Определяем возможные коды ошибок, которые мы ожидаем
type AuthErrorType = 'EmailNotVerified' | 'CredentialsSignin' | string;

// Типизация для результата signIn
interface SignInResult {
  error: string | null;
  status: number;
  ok: boolean;
  url: string | null;
}

export default function SignIn() {
  // Явная типизация для стейта
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');

  // useSession предоставляет объект с полем status, которое имеет определенные литеральные типы
  const { status } = useSession();
  const router = useRouter();
  // useSearchParams может вернуть null, поэтому используем опциональную цепочку
  const searchParams = useSearchParams();

  // Хук useEffect для обработки статуса сессии и ошибок из URL
  useEffect(() => {
    // 1. Если пользователь уже авторизован, перенаправляем на главную
    if (status === 'authenticated') {
      router.replace('/');
      return;
    }

    // 2. Обработка ошибок из URL-параметров
    // searchParams может быть null, поэтому используем опциональную цепочку
    const urlError = searchParams?.get('error') as AuthErrorType | null;

    if (urlError) {
      if (urlError === 'EmailNotVerified') {
        setError(
          '❌ Ваш аккаунт не верифицирован. Пожалуйста, подтвердите email по ссылке в письме.',
        );
      } else if (urlError === 'CredentialsSignin') {
        setError('Неверный email или пароль. Пожалуйста, попробуйте снова.');
      } else {
        // Ловим любые другие необработанные ошибки
        setError('Произошла ошибка входа. Пожалуйста, попробуйте снова.');
      }
    }
  }, [status, router, searchParams]); // Зависимости хука

  // Состояния загрузки и аутентификации
  if (status === 'loading') {
    return (
      <div className={styles.loadingContainer}>
        <p className={styles.loadingText}>Проверка сессии...</p>
      </div>
    );
  }

  // Если состояние 'authenticated', хотя редирект уже сработает в useEffect,
  // это можно оставить как запасной вариант для UX.
  if (status === 'authenticated') {
    return (
      <div className={styles.authenticatedContainer}>
        <p className={styles.loadingText}>Вы вошли. Перенаправление...</p>
      </div>
    );
  }

  /**
   * Обработчик отправки формы входа.
   * Типизация аргумента e: FormEvent
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Явно типизируем провайдера как 'credentials'
    const result = (await signIn('credentials' as LiteralUnion<BuiltInProviderType, string>, {
      redirect: false,
      email,
      password,
    })) as SignInResult; // Приводим результат к созданному интерфейсу

    if (!result.error) {
      // Успешный вход
      router.push('/');
    } else {
      // Ошибка входа
      let errorCode: AuthErrorType;

      if (result.error.includes('EmailNotVerified')) {
        errorCode = 'EmailNotVerified';
      } else {
        errorCode = 'CredentialsSignin';
      }

      // Перенаправляем обратно на страницу входа с кодом ошибки в URL
      router.push(`/auth/signin?error=${errorCode}`);
    }
  };

  /**
   * Обработчик перехода на страницу регистрации.
   */
  const handleSignUpClick = (e: FormEvent) => {
    e.preventDefault();
    router.push('/auth/signup');
  };

  return (
    <div className={styles.signinContainer}>
      <div className={styles.signinBox}>
        <h1 className={styles.title}>
          🔑 Вход в систему
        </h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {/* Поле Email */}
          <div className={styles.formGroup}>
            <label
              htmlFor="email"
              className={styles.label}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Введите ваш email"
              required
              className={styles.input}
            />
          </div>

          {/* Поле Пароль */}
          <div className={styles.formGroup}>
            <label
              htmlFor="password"
              className={styles.label}
            >
              Пароль
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              className={styles.input}
            />
          </div>

          {/* Кнопка отправки */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={status === 'loading'}
          >
            Войти
          </button>

          {/* Ссылка на регистрацию */}
          <p className={styles.signupText}>
            Нет аккаунта?{' '}
            <a
              href="/auth/signup"
              onClick={handleSignUpClick}
              className={styles.signupLink}
            >
              Зарегистрироваться
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
