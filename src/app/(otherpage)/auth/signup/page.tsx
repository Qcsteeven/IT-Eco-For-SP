'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
// Используем библиотеку иконок
import { FiEye, FiEyeOff } from 'react-icons/fi';
// Импортируем модульные SCSS стили
import styles from './SignUp.module.scss';

// Интерфейс для ожидаемого ответа от API регистрации
interface RegisterResponse {
  message: string;
  email?: string; // Ожидаем email в случае успеха
  // Другие поля, если они есть
}

export default function SignUp() {
  // Явная типизация для стейта: <string> или <boolean>
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const router = useRouter();

  /**
   * Обработчик отправки формы регистрации.
   * Типизация аргумента e: FormEvent
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password || !confirmPassword || !fullName) {
      setError('Пожалуйста, заполните все поля.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают. Пожалуйста, проверьте ввод.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Типизация объекта тела запроса
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      // Явно указываем ожидаемый тип данных (RegisterResponse)
      const data: RegisterResponse = await response.json();

      if (!response.ok) {
        // Используем data.message, если оно есть
        setError(
          data.message || 'Ошибка регистрации. Пожалуйста, проверьте данные.',
        );
      } else {
        // Используем email из ответа, если он предоставлен, иначе текущий email
        const verifiedEmail = data.email || email;

        // Перенаправление на страницу верификации
        router.push(
          `/auth/verify-email?email=${encodeURIComponent(verifiedEmail)}`,
        );
      }
    } catch (err) {
      // Приводим ошибку к типу Error для более безопасного логирования
      console.error(
        'Ошибка сети/сервера:',
        err instanceof Error ? err.message : err,
      );
      setError('Произошла ошибка при подключении к серверу.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Переключение видимости паролей.
   */
  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <div className={styles.signupContainer}>
      <div className={styles.signupBox}>
        <h1 className={styles.title}>📝 Регистрация</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          {/* Поле ФИО */}
          <div className={styles.formGroup}>
            <label htmlFor="fullName" className={styles.label}>
              ФИО
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              required
              className={styles.input}
            />
          </div>

          {/* Поле Email */}
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
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
          <div
            className={`${styles.formGroup} ${styles.passwordInputContainer}`}
          >
            <label htmlFor="password" className={styles.label}>
              Пароль
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Создайте пароль"
              required
              className={styles.input}
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className={styles.passwordToggle}
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </button>
          </div>

          {/* Поле Подтверждение пароля */}
          <div
            className={`${styles.formGroup} ${styles.passwordInputContainer}`}
          >
            <label htmlFor="confirmPassword" className={styles.label}>
              Подтвердите пароль
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              required
              className={styles.input}
            />
          </div>

          {/* Кнопка отправки */}
          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          {/* Ссылка на вход */}
          <p className={styles.signinText}>
            Уже есть аккаунт?{' '}
            <a
              onClick={() => router.push('/auth/signin')} // Используем router.push
              className={styles.signinLink}
            >
              Войти
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
