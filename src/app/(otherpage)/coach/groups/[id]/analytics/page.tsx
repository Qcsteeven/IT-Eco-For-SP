'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import PreviousPageLink from '@/components/PreviousPageLink';
import { useParams, useRouter } from 'next/navigation';
import '../../../coach.scss';

type Analytics = {
  members_count: number;
  avg_bscp_rating: number | null;
  platform_distribution: {
    codeforces: number;
    atcoder: number;
    both: number;
    none: number;
  };
  events: {
    total: number;
    completed: number;
    in_period: number | null;
  };
};

export default function CoachGroupAnalyticsPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('coach');
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const groupId = typeof params?.id === 'string' ? params.id : '';

  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  useEffect(() => {
    if (!authorized || !groupId) return;
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, groupId]);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/coach/groups/${groupId}/analytics`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Ошибка загрузки аналитики');
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки аналитики');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || isLoading) return <div className="coach-loading">Загрузка...</div>;

  if (!authorized) {
    return (
      <div className="coach-access-denied">
        <h1>Доступ запрещён</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/coach">Вернуться</Link>
      </div>
    );
  }

  return (
    <div className="coach-page">
      <div className="coach-container">
        <div className="coach-header">
          <PreviousPageLink
            fallbackHref={`/coach/groups/${groupId}`}
            className="coach-back-link"
          />
          <div className="coach-header-content">
            <h1>Аналитика группы</h1>
            <button className="coach-btn coach-btn-primary" onClick={fetchAnalytics}>
              Обновить
            </button>
          </div>
        </div>

        {error && (
          <div className="coach-error-banner">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="coach-loading-inner">Загрузка...</div>
        ) : !data ? (
          <div className="coach-empty">
            <p>Данные не найдены</p>
          </div>
        ) : (
          <>
            <div className="coach-stats-grid">
              <div className="coach-stat-card">
                <div className="coach-stat-icon">👥</div>
                <div className="coach-stat-content">
                  <h3>Участников</h3>
                  <p className="coach-stat-value">{data.members_count}</p>
                </div>
              </div>
              <div className="coach-stat-card">
                <div className="coach-stat-icon">📈</div>
                <div className="coach-stat-content">
                  <h3>Средний BSCP рейтинг</h3>
                  <p className="coach-stat-value">
                    {data.avg_bscp_rating == null ? '—' : data.avg_bscp_rating.toFixed(0)}
                  </p>
                </div>
              </div>
              <div className="coach-stat-card">
                <div className="coach-stat-icon">🗓️</div>
                <div className="coach-stat-content">
                  <h3>Событий назначено</h3>
                  <p className="coach-stat-value">{data.events.total}</p>
                </div>
              </div>
              <div className="coach-stat-card">
                <div className="coach-stat-icon">✅</div>
                <div className="coach-stat-content">
                  <h3>Событий завершено</h3>
                  <p className="coach-stat-value">{data.events.completed}</p>
                </div>
              </div>
            </div>

            <div className="coach-section">
              <h2>Платформы</h2>
              <div className="coach-platform-stats">
                <div className="coach-platform-item">
                  <span>Codeforces</span>
                  <span className="coach-platform-value">{data.platform_distribution.codeforces}</span>
                </div>
                <div className="coach-platform-item">
                  <span>AtCoder</span>
                  <span className="coach-platform-value">{data.platform_distribution.atcoder}</span>
                </div>
                <div className="coach-platform-item">
                  <span>Обе платформы</span>
                  <span className="coach-platform-value">{data.platform_distribution.both}</span>
                </div>
                <div className="coach-platform-item">
                  <span>Не подключены</span>
                  <span className="coach-platform-value">{data.platform_distribution.none}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

