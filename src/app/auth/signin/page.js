'use client';
import { signIn, useSession } from 'next-auth/react';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }

    const urlError = searchParams.get('error');

    if (urlError) {
      if (urlError === 'EmailNotVerified') {
        setError(
          '❌ Ваш аккаунт не верифицирован. Пожалуйста, подтвердите email по ссылке в письме.',
        );
      } else if (urlError === 'CredentialsSignin') {
        setError('Неверный email или пароль. Пожалуйста, попробуйте снова.');
      } else {
        setError('Произошла ошибка входа. Пожалуйста, попробуйте снова.');
      }
    }
  }, [status, router, searchParams]);

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <p className="text-lg text-gray-300">Проверка сессии...</p>
      </div>
    );
  }

  if (status === 'authenticated') {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <p className="text-lg text-gray-300">Вы вошли. Перенаправление...</p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (!result.error) {
      router.push('/');
    } else {
      let errorCode;

      if (result.error.includes('EmailNotVerified')) {
        errorCode = 'EmailNotVerified';
      } else {
        errorCode = 'CredentialsSignin';
      }

      router.push(`/auth/signin?error=${errorCode}`);
    }
  };

  const handleSignUpClick = (e) => {
    e.preventDefault();
    router.push('/auth/signup');
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-black p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-900 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-white">
          🔑 Вход в систему
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-900 rounded-lg">
              {error}
            </div>
          )}

          {/* Поля Email и Пароль */}
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
              className="mt-1 block w-full px-4 py-2 border border-gray-700 bg-gray-800 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300"
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
              className="mt-1 block w-full px-4 py-2 border border-gray-700 bg-gray-800 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Кнопки */}
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            Войти
          </button>

          <p className="text-center text-sm text-gray-400 pt-2">
            Нет аккаунта?{' '}
            <a
              href="/auth/signup"
              onClick={handleSignUpClick}
              className="text-blue-500 hover:text-blue-400 font-medium transition duration-150 cursor-pointer"
            >
              Зарегистрироваться
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
