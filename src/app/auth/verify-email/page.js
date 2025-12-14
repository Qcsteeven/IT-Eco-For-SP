'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const safeFetch = async (url, body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let data = { message: 'Внутренняя ошибка сервера.' };

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(
        `Сервер вернул не JSON (HTTP ${response.status}):`,
        responseText.substring(0, 100) + '...',
      );
    }

    return { response, data };
  };

  const handleSubmit = async (e) => {
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

  const handleResendCode = async () => {
    setMessage('');
    setLoading(true);

    if (!email) {
      setMessage('Пожалуйста, введите email, чтобы отправить код повторно.');
      setLoading(false);
      return;
    }

    try {
      const { response, data } = await safeFetch('/api/resend-code', { email });

      if (response.ok) {
        setMessage(data.message || 'Новый код успешно отправлен!');

        setCode('');
      } else {
        setMessage(
          data.message ||
            `Ошибка при повторной отправке кода: статус ${response.status}.`,
        );
      }
    } catch (error) {
      setMessage('Сетевая ошибка при запросе нового кода.');
      console.error('Resend code error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '50px auto',
        padding: '20px',
        border: '1px solid #555',
        borderRadius: '8px',
        color: '#fff',
        backgroundColor: '#1e1e1e',
      }}
    >
      <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        Подтверждение Email 📧
      </h2>
      <p style={{ color: '#ccc' }}>
        Введите email и код, который вы получили на почту.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label
            htmlFor="email"
            style={{
              display: 'block',
              marginBottom: '5px',
              color: '#ccc',
              fontWeight: 'bold',
            }}
          >
            Email:
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading || isSuccess}
            style={{
              width: '100%',
              padding: '10px',
              boxSizing: 'border-box',
              backgroundColor: '#333',
              border: '1px solid #555',
              color: '#fff',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="code"
            style={{
              display: 'block',
              marginBottom: '5px',
              color: '#ccc',
              fontWeight: 'bold',
            }}
          >
            Код подтверждения (6 цифр):
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            maxLength="6"
            required
            disabled={loading || isSuccess}
            style={{
              width: '100%',
              padding: '10px',
              boxSizing: 'border-box',
              fontSize: '1.2em',
              textAlign: 'center',
              backgroundColor: '#333',
              border: '1px solid #555',
              color: '#fff',
              borderRadius: '4px',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || isSuccess}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: isSuccess ? '#4CAF50' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'background-color 0.3s',
          }}
        >
          {loading && !isSuccess
            ? 'Проверка...'
            : isSuccess
              ? 'Аккаунт верифицирован!'
              : 'Подтвердить'}
        </button>
      </form>

      {message && (
        <p
          style={{
            marginTop: '20px',
            color: isSuccess ? '#8bc34a' : '#ff4444',
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {message}
        </p>
      )}

      {!isSuccess && (
        <p
          style={{ marginTop: '15px', textAlign: 'center', fontSize: '0.9em' }}
        >
          Не получили код?
          <button
            onClick={handleResendCode}
            disabled={loading}
            style={{
              marginLeft: '5px',
              background: 'none',
              border: 'none',
              color: loading ? '#666' : '#0070f3',
              cursor: loading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              padding: '0',
              fontSize: 'inherit',
            }}
          >
            {loading ? 'Отправляем...' : 'Отправить повторно'}
          </button>
        </p>
      )}
    </div>
  );
}
