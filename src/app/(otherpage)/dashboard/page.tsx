'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CodeforcesConnect from '@/components/CodeforcesConnect';
import './dashboard.scss';

interface UserData {
  id: string;
  full_name: string;
  cf_username?: string | null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false); // Состояние для сообщения об успехе

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
      return;
    }
    if (status === 'authenticated') {
      fetchProfileData();
    }
  }, [status, router]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile');
      const result = await response.json();

      if (response.ok && result.ok && result.data) {
        setUserData({
          ...result.data.user,
          id: result.data.user.id,
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationSuccess = (handle: string) => {
    setIsSuccess(true);
    setUserData((prev) => (prev ? { ...prev, cf_username: handle } : null));

    // Через 2 секунды перекидываем в профиль
    setTimeout(() => {
      router.push('/profile');
    }, 2000);
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      `Вы уверены, что хотите отвязать аккаунт Codeforces: ${userData?.cf_username}?`,
    );
    if (!confirmed) return;

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cf_username: null }),
      });

      if (response.ok) {
        setUserData((prev) => (prev ? { ...prev, cf_username: null } : null));
        alert('Аккаунт успешно отвязан');
      }
    } catch (error) {
      alert('Ошибка при отключении');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="dashboard-loading">
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Панель управления</h1>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h2 className="card-title">Обзор профиля</h2>
          <p>
            Добро пожаловать,{' '}
            <strong>{userData?.full_name || 'Пользователь'}</strong>
          </p>
        </div>

        <div className="dashboard-card">
          <h2 className="card-title">Интеграция Codeforces</h2>

          {/* 1. Сообщение об успешной верификации */}
          {isSuccess && (
            <div className="success-banner">
              🎉 Верификация прошла успешно! Перенаправление в профиль...
            </div>
          )}

          {/* 2. Если аккаунт подключен — показываем статусную кнопку */}
          {userData?.cf_username ? (
            <div className="connected-wrapper">
              <p className="info-text">
                Ваш аккаунт Codeforces успешно привязан к системе.
              </p>

              <button
                className="btn-status-connected"
                onClick={handleDisconnect}
                title="Нажмите, чтобы отвязать"
              >
                <span className="dot"></span>
                Подключено: {userData.cf_username}
              </button>

              <p className="hint-text">
                Нажмите на кнопку выше, если хотите отвязать аккаунт.
              </p>
            </div>
          ) : (
            /* 3. Если не подключен — показываем форму */
            <div className={isSuccess ? 'fade-out' : ''}>
              <p className="info-text">
                Подключите аккаунт для синхронизации рейтинга.
              </p>
              <CodeforcesConnect
                userId={userData?.id || ''}
                onVerified={handleVerificationSuccess}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
