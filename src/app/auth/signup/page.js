// src/app/auth/signup/page.js

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e) => {
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

    // 2. Отправка данных на ваш собственный API-маршрут регистрации
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || 'Ошибка регистрации. Пожалуйста, проверьте данные.',
        );
      } else {
        // 🚀 ИЗМЕНЕНИЕ: Используем email, возвращенный сервером (data.email)
        const verifiedEmail = data.email || email;

        // 🛑 УДАЛЕН alert() для надежного перенаправления.

        // ПЕРЕНАПРАВЛЕНИЕ НА СТРАНИЦУ, ГДЕ НУЖНО ВВЕСТИ КОД
        router.push(
          `/auth/verify-email?email=${encodeURIComponent(verifiedEmail)}`,
        );
      }
    } catch (err) {
      console.error('Ошибка сети/сервера:', err);
      setError('Произошла ошибка при подключении к серверу.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  // --- Рендеринг тёмной формы Регистрации (оставлен без изменений) ---
  return (
    <div className="flex justify-center items-center min-h-screen bg-black p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-900 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-white">
          📝 Регистрация
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-900 rounded-lg">
              {error}
            </div>
          )}

          {/* Поле ФИО */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-gray-300"
            >
              ФИО
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-700 bg-gray-800 text-white rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Поле Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300"
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
              className="mt-1 block w-full px-4 py-2 border border-gray-700 bg-gray-800 text-white rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* 🚀 ПОЛЕ ПАРОЛЬ (С КНОПКОЙ ПОКАЗА) */}
          <div className="relative">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300"
            >
              Пароль
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Создайте пароль"
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-700 bg-gray-800 text-white rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 pr-10"
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute inset-y-0 right-0 top-6 flex items-center pr-3 text-gray-400 hover:text-white transition"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </button>
          </div>

          {/* 🚀 ПОЛЕ ПОДТВЕРЖДЕНИЕ ПАРОЛЯ */}
          <div className="relative">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-300"
            >
              Подтвердите пароль
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-700 bg-gray-800 text-white rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 pr-10"
            />
          </div>

          {/* Кнопка Регистрации */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out disabled:bg-gray-500"
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          <p className="text-center text-sm text-gray-400 mt-4">
            Уже есть аккаунт?{' '}
            <a
              href="/auth/signin"
              className="text-blue-500 hover:text-blue-400 font-medium"
            >
              Войти
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
