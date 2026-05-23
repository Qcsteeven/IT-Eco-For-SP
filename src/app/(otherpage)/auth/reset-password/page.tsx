'use client';

import { FormEvent, Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import styles from '../signin/SignIn.module.scss';

type ResetResponse = {
  ok: boolean;
  message?: string;
};

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';
  const isLinkReady = Boolean(email && token);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });
      const data = (await res.json()) as ResetResponse;

      if (!res.ok || !data.ok) {
        setError(data.message || 'Не удалось обновить пароль.');
        return;
      }

      setMessage(data.message || 'Пароль обновлен.');
      setTimeout(() => router.push('/auth/signin'), 1200);
    } catch {
      setError('Не удалось подключиться к серверу.');
    } finally {
      setLoading(false);
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
          <div>
            <h1 className={styles.title}>Новый пароль</h1>
            <p className={styles.helperText}>
              Придумайте новый пароль для аккаунта {email || 'IT-Eco-For-SP'}.
            </p>
          </div>

          {!isLinkReady && (
            <div className={styles.error}>
              Ссылка восстановления некорректна. Запросите новую ссылку.
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}
          {message && <div className={styles.success}>{message}</div>}

          <div className={styles.field}>
            <label className={styles.srOnly} htmlFor="reset-password">
              Новый пароль
            </label>
            <div className={styles.password}>
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Новый пароль"
                required
                minLength={6}
                autoComplete="new-password"
                className={styles.input}
                disabled={!isLinkReady}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.srOnly} htmlFor="reset-password-confirm">
              Повторите пароль
            </label>
            <input
              id="reset-password-confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Повторите пароль"
              required
              minLength={6}
              autoComplete="new-password"
              className={styles.input}
              disabled={!isLinkReady}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isLinkReady}
            className={styles.submitButton}
          >
            {loading ? 'Сохраняем...' : 'Сохранить пароль'}
          </button>

          <div className={styles.linksRow}>
            <Link href="/auth/signin" className={styles.linkBtn}>
              Вернуться ко входу
            </Link>
            <Link href="/auth/forgot-password" className={styles.linkBtn}>
              Новая ссылка
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className={styles.loaderFull}>Загрузка...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
