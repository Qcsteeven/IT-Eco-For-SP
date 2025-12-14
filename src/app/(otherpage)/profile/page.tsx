'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import './profile.scss';

// 1. Обновляем интерфейс
interface UserData {
  full_name: string;
  email: string;
  bscp_rating: number;
  phone?: string;
  cf_username?: string | null; // Новое поле
}

interface HistoryItem {
  date_recorded: string;
  placement: string;
  mmr_change: number;
  is_manual: boolean;
  source_rating_change: string;
  contest: {
    title: string;
    platform: string;
  };
}

interface ProfileApiResponse {
  ok: boolean;
  data?: {
    user: UserData;
    history: HistoryItem[];
  };
  error?: string;
}

const ProfilePage: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      const fetchProfileData = async () => {
        try {
          setLoading(true);
          const response = await fetch('/api/profile');
          const result: ProfileApiResponse = await response.json();

          if (response.ok && result.ok && result.data) {
            setUserData(result.data.user);
            setHistoryData(result.data.history);
          } else {
            setError(result.error || 'Не удалось загрузить данные профиля.');
          }
        } catch (err: any) {
          console.error('Fetch error:', err);
          setError('Сетевая ошибка при загрузке данных.');
        } finally {
          setLoading(false);
        }
      };

      fetchProfileData();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <main>
        <section id="profile">
          <p>Загрузка профиля...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <section id="profile">
          <h1 style={{ color: 'red' }}>Ошибка</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!userData) {
    return (
      <main>
        <section id="profile">
          <p>Данные профиля не найдены.</p>
          <button onClick={() => signOut()}>Выйти</button>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section id="profile" style={{ display: 'block' }}>
        <div className="profile-header">
          <h2>{userData.full_name || 'Неизвестный пользователь'}</h2>
          <div className="rating">{userData.bscp_rating}</div>
          <div className="rating-label">Рейтинг в системе БЦСП</div>
          <button onClick={() => signOut()} className="btn-logout">
            Выйти
          </button>
        </div>

        <h1>Вход в внешние системы</h1>
        <div className="systems-links">
          {/* 2. ЛОГИКА ДЛЯ CODEFORCES */}
          <a
            // Если есть юзернейм -> ссылка на его профиль CF. Если нет -> ссылка на подключение
            href={
              userData.cf_username
                ? `https://codeforces.com/profile/${userData.cf_username}`
                : '/dashboard'
            }
            target="_blank"
            rel="noopener noreferrer"
            // Меняем стиль, если подключено (опционально, можно добавить класс 'connected')
            className={`system-link ${userData.cf_username ? 'connected' : ''}`}
            style={
              userData.cf_username
                ? { borderColor: '#4caf50', color: '#4caf50' }
                : {}
            }
          >
            {userData.cf_username
              ? `Профиль Codeforces: ${userData.cf_username}`
              : 'Подключить Codeforces'}
          </a>

          <a
            href="https://contest.yandex.ru/enter"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в Yandex.Contest
          </a>
          <a
            href="https://atcoder.jp/login"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в AtCoder
          </a>
          <a
            href="https://leetcode.com/accounts/login/"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в LeetCode
          </a>
          <a
            href="https://icpc.global/login"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в ICPC
          </a>
        </div>

        <h1>История участия и изменения рейтинга</h1>
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Соревнование</th>
              <th>Платформа</th>
              <th>Результат / Изменение рейтинга</th>
              <th>Изменение рейтинга БЦСП</th>
            </tr>
          </thead>
          <tbody>
            {historyData.length > 0 ? (
              historyData.map((item, index) => (
                <tr key={index}>
                  <td>{new Date(item.date_recorded).toLocaleDateString()}</td>
                  <td>{item.contest.title}</td>
                  <td>{item.contest.platform}</td>
                  <td>
                    {item.placement}
                    {item.is_manual && (
                      <span className="manual-tag">вручную</span>
                    )}
                    {item.source_rating_change &&
                      ` (${item.source_rating_change})`}
                  </td>
                  <td
                    className={`rating-change ${item.mmr_change < 0 ? 'negative' : ''}`}
                  >
                    {item.mmr_change > 0
                      ? `+${item.mmr_change}`
                      : item.mmr_change}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>История участия пока пуста.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h1>Изменение личных данных</h1>
        <form className="edit-form">
          <label htmlFor="name">ФИО</label>
          <input
            type="text"
            id="name"
            defaultValue={userData.full_name || ''}
            placeholder="Введите ФИО"
            disabled={loading}
          />

          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            defaultValue={userData.email || ''}
            placeholder="Введите email"
            readOnly
            disabled={loading}
          />

          <label htmlFor="password">Новый пароль</label>
          <input
            type="password"
            id="password"
            placeholder="Введите новый пароль"
            disabled={loading}
          />

          <label htmlFor="phone">Телефон</label>
          <input
            type="tel"
            id="phone"
            defaultValue={userData.phone || ''}
            placeholder="Введите телефон"
            disabled={loading}
          />

          <button type="submit" className="btn-save" disabled={loading}>
            Сохранить изменения
          </button>
        </form>
      </section>
    </main>
  );
};

export default ProfilePage;
