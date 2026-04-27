'use client';

import React, { useState, useEffect, FormEvent, Suspense } from 'react';
import { signIn, useSession, LiteralUnion } from 'next-auth/react';
import { BuiltInProviderType } from 'next-auth/providers/index';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import styles from './SignIn.module.scss';

type AuthErrorType = 'EmailNotVerified' | 'CredentialsSignin' | string;

interface SignInResult {
  error: string | null;
  status: number;
  ok: boolean;
  url: string | null;
}

function SignInForm() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/home');
      return;
    }

    const urlError = searchParams?.get('error') as AuthErrorType | null;
    if (urlError) {
      if (urlError === 'EmailNotVerified') {
        setError('Ваш аккаунт не верифицирован.');
      } else if (urlError === 'CredentialsSignin') {
        setError('Неверный email или пароль.');
      } else {
        setError('Произошла ошибка входа.');
      }
    }
  }, [status, router, searchParams]);

  if (status === 'loading') {
    return <div className={styles.loaderFull}>Загрузка...</div>;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const result = (await signIn(
      'credentials' as LiteralUnion<BuiltInProviderType, string>,
      { redirect: false, email, password },
    )) as SignInResult;

    if (!result.error) {
      router.push('/');
    } else {
      const errorCode: AuthErrorType = result.error.includes('EmailNotVerified')
        ? 'EmailNotVerified'
        : 'CredentialsSignin';
      router.push(`/auth/signin?error=${errorCode}`);
    }
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

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className={styles.srOnly} htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.srOnly} htmlFor="auth-password">
              Пароль
            </label>
            <div className={styles.password}>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                required
                autoComplete="current-password"
                className={styles.input}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submitButton}>
            Войти
          </button>

          <div className={styles.linksRow}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setError('Восстановление пароля пока не реализовано.')}
            >
              Забыли пароль?
            </button>
            <Link href="/auth/signup" className={styles.linkBtn}>
              Регистрация
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<div className={styles.loaderFull}>Загрузка...</div>}>
      <SignInForm />
    </Suspense>
  );
}
