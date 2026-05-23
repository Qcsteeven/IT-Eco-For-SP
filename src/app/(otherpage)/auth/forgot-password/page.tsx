'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from '../signin/SignIn.module.scss';

type ForgotResponse = {
  ok: boolean;
  message?: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as ForgotResponse;

      if (!res.ok || !data.ok) {
        setError(data.message || 'Не удалось отправить письмо.');
        return;
      }

      setMessage(data.message || 'Письмо отправлено.');
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
            <h1 className={styles.title}>Восстановление пароля</h1>
            <p className={styles.helperText}>
              Укажите email аккаунта. Мы отправим ссылку для смены пароля, если
              такой пользователь есть в системе.
            </p>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          {message && <div className={styles.success}>{message}</div>}

          <div className={styles.field}>
            <label className={styles.srOnly} htmlFor="forgot-email">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className={styles.input}
            />
          </div>

          <button type="submit" disabled={loading} className={styles.submitButton}>
            {loading ? 'Отправляем...' : 'Отправить ссылку'}
          </button>

          <div className={styles.linksRow}>
            <Link href="/auth/signin" className={styles.linkBtn}>
              Вернуться ко входу
            </Link>
            <Link href="/auth/signup" className={styles.linkBtn}>
              Регистрация
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
