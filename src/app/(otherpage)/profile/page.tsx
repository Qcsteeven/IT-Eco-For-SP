'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import './profile.scss';

interface UserData {
  full_name: string;
  email: string;
  bscp_rating: number;
  phone?: string;
  cf_username?: string | null;
}

interface HistoryItem {
  date_recorded: string; // ISO string
  placement: string; // e.g. "5376"
  mmr_change: number; // e.g. 72
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Фильтры
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [placeFrom, setPlaceFrom] = useState<string>('');
  const [placeTo, setPlaceTo] = useState<string>('');
  const [ratingSort, setRatingSort] = useState<'none' | 'asc' | 'desc'>('none');

  // Редирект при неавторизованном доступе
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [status, router]);

  // Загрузка данных
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
            if (response.status === 401) signOut();
          }
        } catch (err: any) {
          console.error('Fetch error:', err);
          setError('Сетевая ошибка при загрузке данных.');
        } finally {
          setLoading(false);
        }
      };

      fetchProfileData();
    }
  }, [status]);

  // Уникальные платформы
  const platforms = useMemo(() => {
    const unique = new Set<string>();
    historyData.forEach((item) => unique.add(item.contest.platform));
    return Array.from(unique).sort();
  }, [historyData]);

  // Фильтрация и сортировка
  const filteredAndSortedHistory = useMemo(() => {
    let result = [...historyData];

    // Фильтр по дате
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter(
        (item) => new Date(item.date_recorded) >= fromDate,
      );
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // до конца дня
      result = result.filter((item) => new Date(item.date_recorded) <= toDate);
    }

    // Фильтр по платформе
    if (platformFilter !== 'all') {
      result = result.filter(
        (item) => item.contest.platform === platformFilter,
      );
    }

    // Фильтр по месту (placement)
    if (placeFrom || placeTo) {
      const minPlace = placeFrom ? parseInt(placeFrom, 10) : -Infinity;
      const maxPlace = placeTo ? parseInt(placeTo, 10) : Infinity;

      if (!isNaN(minPlace) || !isNaN(maxPlace)) {
        result = result.filter((item) => {
          const placeNum = parseInt(item.placement, 10);
          if (isNaN(placeNum)) return false;
          return placeNum >= minPlace && placeNum <= maxPlace;
        });
      }
    }

    // Сортировка по рейтингу БЦСП (mmr_change)
    if (ratingSort !== 'none') {
      result.sort((a, b) => {
        if (ratingSort === 'asc') {
          return a.mmr_change - b.mmr_change;
        } else {
          return b.mmr_change - a.mmr_change;
        }
      });
    }

    return result;
  }, [
    historyData,
    dateFrom,
    dateTo,
    platformFilter,
    placeFrom,
    placeTo,
    ratingSort,
  ]);

  // Обработка отвязки CF
  const handleDisconnectCF = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!userData?.cf_username) return;

    const confirmed = window.confirm(
      `Вы уверены, что хотите отвязать Codeforces аккаунт: ${userData.cf_username}? Рейтинг будет пересчитан.`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cf_username: null }),
      });

      const result = await response.json();

      if (response.ok) {
        setUserData((prev) =>
          prev
            ? {
                ...prev,
                cf_username: null,
                bscp_rating: result.new_rating ?? prev.bscp_rating,
              }
            : null,
        );
        alert('Аккаунт Codeforces отвязан. Рейтинг обновлен.');
      } else {
        alert('Ошибка при отвязке аккаунта');
      }
    } catch (err) {
      alert('Ошибка соединения с сервером.');
    }
  };

  // Сохранение формы
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      full_name: formData.get('full_name'),
      phone: formData.get('phone'),
      oldPassword: formData.get('oldPassword'),
      newPassword: formData.get('newPassword'),
    };

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Данные успешно сохранены!');
        setUserData((prev) =>
          prev
            ? {
                ...prev,
                full_name: payload.full_name as string,
                phone: payload.phone as string,
              }
            : null,
        );
        (e.target as HTMLFormElement).reset();
      } else {
        alert(result.error || 'Ошибка при сохранении');
      }
    } catch (err) {
      alert('Ошибка соединения с сервером.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setPlatformFilter('all');
    setPlaceFrom('');
    setPlaceTo('');
    setRatingSort('none');
  };

  if (status === 'loading' || loading) {
    return (
      <main>
        <section id="profile">
          <p className="status-msg">Загрузка профиля...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <section id="profile">
          <h1 className="error-title">Ошибка</h1>
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
          <button onClick={() => signOut()} className="btn-logout">
            Выйти
          </button>
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

        <h1>Вход во внешние системы</h1>
        <div className="systems-links">
          {userData.cf_username ? (
            <button
              onClick={handleDisconnectCF}
              className="system-link connected-cf"
              title="Нажмите, чтобы отвязать"
            >
              <span className="status-indicator"></span>
              <div className="cf-info">
                <span className="cf-label">Подключено Codeforces</span>
                <span className="cf-nickname">{userData.cf_username}</span>
              </div>
            </button>
          ) : (
            <a href="/dashboard" className="system-link">
              Подключить Codeforces
            </a>
          )}

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

        {/* Фильтры */}
        <div className="filters-section">
          {/* Дата */}
          <div className="filter-group">
            <label>Дата (от):</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Дата (до):</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Платформа */}
          <div className="filter-group">
            <label>Платформа:</label>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="all">Все</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Место (диапазон) */}
          <div className="filter-group">
            <label>Место от:</label>
            <input
              type="number"
              min="1"
              value={placeFrom}
              onChange={(e) => setPlaceFrom(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="filter-group">
            <label>Место до:</label>
            <input
              type="number"
              min="1"
              value={placeTo}
              onChange={(e) => setPlaceTo(e.target.value)}
              placeholder="1000"
            />
          </div>

          {/* Сортировка по рейтингу */}
          <div className="filter-group">
            <label>Рейтинг БЦСП:</label>
            <select
              value={ratingSort}
              onChange={(e) =>
                setRatingSort(e.target.value as 'none' | 'asc' | 'desc')
              }
            >
              <option value="none">Без сортировки</option>
              <option value="asc">По возрастанию</option>
              <option value="desc">По убыванию</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-reset-filters"
            onClick={handleResetFilters}
          >
            Сбросить
          </button>
        </div>

        {/* Таблица */}
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Соревнование</th>
              <th>Платформа</th>
              <th>Результат</th>
              <th>Рейтинг БЦСП</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedHistory.length > 0 ? (
              filteredAndSortedHistory.map((item, index) => (
                <tr key={index}>
                  <td>{new Date(item.date_recorded).toLocaleDateString()}</td>
                  <td>{item.contest.title}</td>
                  <td>{item.contest.platform}</td>
                  <td>
                    {item.placement}
                    {item.is_manual && (
                      <span className="manual-tag">вручную</span>
                    )}
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
                <td colSpan={5}>Нет записей, соответствующих фильтрам.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h1>Изменение личных данных</h1>
        <form className="edit-form" onSubmit={handleSubmit}>
          <label htmlFor="name">ФИО</label>
          <input
            type="text"
            id="name"
            name="full_name"
            defaultValue={userData.full_name || ''}
            disabled={saving}
          />

          <label htmlFor="phone">Телефон</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            defaultValue={userData.phone || ''}
            disabled={saving}
          />

          <div className="form-section-title">
            <h3>Смена пароля</h3>
            <p>Заполните только для изменения пароля</p>
          </div>

          <label htmlFor="oldPassword">Старый пароль</label>
          <input
            type="password"
            id="oldPassword"
            name="oldPassword"
            placeholder="Текущий пароль"
            disabled={saving}
          />

          <label htmlFor="newPassword">Новый пароль</label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            placeholder="Новый пароль"
            disabled={saving}
          />

          <div className="btn-save-container">
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default ProfilePage;
