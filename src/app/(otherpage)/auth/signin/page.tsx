'use client';

import React, { useState, useEffect, FormEvent, Suspense } from 'react';
import { signIn, useSession, LiteralUnion } from 'next-auth/react';
import { BuiltInProviderType } from 'next-auth/providers/index';
import { useRouter, useSearchParams } from 'next/navigation';
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
    <div className={styles.signinWrapper}>
      <div className={styles.signinBox}>
        <h1 className={styles.title}>🔑 Вход</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Введите ваш email"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Пароль</label>
            <div className={styles.passwordInputWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
                className={styles.input}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submitButton}>
            Войти
          </button>

          <p className={styles.signupText}>
            Нет аккаунта?{' '}
            <span
              onClick={() => router.push('/auth/signup')}
              className={styles.signupLink}
            >
              Зарегистрироваться
            </span>
          </p>
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
