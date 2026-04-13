'use client';

import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import '../coach.scss';

interface UserStats {
  total_users: number;
  active_users: number;
  avg_rating: number;
  total_contests: number;
}

interface AdminStats extends UserStats {
  total_karma_adjustments: number;
  recent_karma_changes: Array<{
    user_email: string;
    karma_delta: number;
    reason: string;
    date: string;
  }>;
  platform_distribution: {
    codeforces: number;
    atcoder: number;
    both: number;
    none: number;
  };
}

export default function CoachAnalyticsPage() {
  const { status } = useSession();
  const { authorized, isLoading, role } = useRoleGuard('coach');
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  useEffect(() => {
    if (authorized) {
      fetchAnalytics();
    }
  }, [authorized]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/analytics');
      const data = await res.json();

      if (data.ok) {
        setStats(data.data);
      } else {
        setError(data.error || 'Ошибка загрузки аналитики');
      }
    } catch (err) {
      setError('Не удалось загрузить аналитику');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return <div className="coach-loading">Загрузка...</div>;
  }

  if (!authorized) {
    return (
      <div className="coach-access-denied">
        <h1>Доступ запрещён</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/admin">Вернуться в панель администратора</Link>
      </div>
    );
  }

  return (
    <div className="coach-page">
      <div className="coach-container">
        <div className="coach-header">
          <Link href="/admin" className="coach-back-link">← Назад</Link>
          <h1>Аналитика</h1>
        </div>

        {error && (
          <div className="coach-error-banner">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="coach-loading-inner">Загрузка статистики...</div>
        ) : stats ? (
          <>
            <div className="coach-stats-grid">
              <div className="coach-stat-card">
                <div className="coach-stat-icon">👥</div>
                <div className="coach-stat-content">
                  <h3>Всего пользователей</h3>
                  <p className="coach-stat-value">{stats.total_users}</p>
                </div>
              </div>

              <div className="coach-stat-card">
                <div className="coach-stat-icon">🎯</div>
                <div className="coach-stat-content">
                  <h3>Активных пользователей</h3>
                  <p className="coach-stat-value">{stats.active_users}</p>
                </div>
              </div>

              <div className="coach-stat-card">
                <div className="coach-stat-icon">📊</div>
                <div className="coach-stat-content">
                  <h3>Средний рейтинг</h3>
                  <p className="coach-stat-value">{stats.avg_rating ? stats.avg_rating.toFixed(0) : '—'}</p>
                </div>
              </div>

              <div className="coach-stat-card">
                <div className="coach-stat-icon">🏆</div>
                <div className="coach-stat-content">
                  <h3>Всего контестов</h3>
                  <p className="coach-stat-value">{stats.total_contests}</p>
                </div>
              </div>
            </div>

            {'platform_distribution' in stats && (
              <div className="coach-section">
                <h2>Распределение по платформам</h2>
                <div className="coach-platform-stats">
                  <div className="coach-platform-item">
                    <span>Codeforces</span>
                    <span className="coach-platform-value">{stats.platform_distribution.codeforces}</span>
                  </div>
                  <div className="coach-platform-item">
                    <span>AtCoder</span>
                    <span className="coach-platform-value">{stats.platform_distribution.atcoder}</span>
                  </div>
                  <div className="coach-platform-item">
                    <span>Обе платформы</span>
                    <span className="coach-platform-value">{stats.platform_distribution.both}</span>
                  </div>
                  <div className="coach-platform-item">
                    <span>Не подключены</span>
                    <span className="coach-platform-value">{stats.platform_distribution.none}</span>
                  </div>
                </div>
              </div>
            )}

            {'recent_karma_changes' in stats && (
              <div className="coach-section">
                <h2>Последние изменения кармы</h2>
                <div className="coach-karma-log">
                  <table className="coach-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Изменение</th>
                        <th>Причина</th>
                        <th>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent_karma_changes.map((change, idx) => (
                        <tr key={idx}>
                          <td>{change.user_email}</td>
                          <td>
                            <span className={`karma-${change.karma_delta >= 0 ? 'positive' : 'negative'}`}>
                              {change.karma_delta >= 0 ? '+' : ''}{change.karma_delta}
                            </span>
                          </td>
                          <td>{change.reason}</td>
                          <td>{new Date(change.date).toLocaleString('ru-RU')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="coach-empty">
            <p>Статистика не найдена</p>
          </div>
        )}
      </div>
    </div>
  );
}
