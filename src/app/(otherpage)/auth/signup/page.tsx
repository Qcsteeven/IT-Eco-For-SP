'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import styles from './SignUp.module.scss';

interface RegisterResponse {
  message: string;
  email?: string;
}

export default function SignUp() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data: RegisterResponse = await response.json();

      if (!response.ok) {
        setError(data.message || 'Ошибка регистрации.');
      } else {
        router.push(
          `/auth/verify-email?email=${encodeURIComponent(data.email || email)}`,
        );
      }
    } catch {
      setError('Ошибка подключения к серверу.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardLogo} aria-hidden="true">
          <Image
            src="/brand/cpcore-logo.png"
            alt=""
            width={979}
            height={546}
            priority
          />
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className={styles.srOnly} htmlFor="reg-fullname">
              ФИО
            </label>
            <input
              id="reg-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Имя пользователя *"
              required
              autoComplete="name"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.srOnly} htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email *"
              required
              autoComplete="email"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.srOnly} htmlFor="reg-password">
              Пароль
            </label>
            <div className={styles.password}>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль *"
                required
                autoComplete="new-password"
                className={styles.input}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={styles.eyeBtn}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.srOnly} htmlFor="reg-password-confirm">
              Подтверждение пароля
            </label>
            <input
              id="reg-password-confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль *"
              required
              autoComplete="new-password"
              className={styles.input}
            />
          </div>

          <div className={styles.linksRow}>
            <span className={styles.linkMuted}>Уже есть аккаунт?</span>
            <Link href="/auth/signin" className={styles.linkStrong}>
              Войдите
            </Link>
          </div>

          <button type="submit" disabled={loading} className={styles.submitButton}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
}
