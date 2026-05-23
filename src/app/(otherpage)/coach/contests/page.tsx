'use client';

import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import Link from 'next/link';
import PreviousPageLink from '@/components/PreviousPageLink';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import '../coach.scss';

interface Contest {
  id: string;
  name: string;
  platform: string;
  start_time: string;
  duration: string;
  status: 'upcoming' | 'active' | 'completed';
}

export default function CoachContestsPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('coach');
  const router = useRouter();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newContest, setNewContest] = useState({
    name: '',
    platform: 'codeforces',
    start_time: '',
    duration: '',
  });

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  useEffect(() => {
    if (authorized) {
      fetchContests();
    }
  }, [authorized]);

  const fetchContests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/contests');
      const data = await res.json();

      if (data.ok) {
        setContests(data.data);
      } else {
        setError(data.error || 'Ошибка загрузки контестов');
      }
    } catch (err) {
      setError('Не удалось загрузить контесты');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/contests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContest),
      });

      const data = await res.json();

      if (data.ok) {
        setShowCreateForm(false);
        setNewContest({ name: '', platform: 'codeforces', start_time: '', duration: '' });
        await fetchContests();
      } else {
        setError(data.error || 'Ошибка создания контеста');
      }
    } catch (err) {
      setError('Не удалось создать контест');
      console.error(err);
    }
  };

  const handleDeleteContest = async (contestId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот контест?')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/contests/${contestId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.ok) {
        await fetchContests();
      } else {
        setError(data.error || 'Ошибка удаления контеста');
      }
    } catch (err) {
      setError('Не удалось удалить контест');
      console.error(err);
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
          <PreviousPageLink fallbackHref="/admin" className="coach-back-link" />
          <div className="coach-header-content">
            <h1>Управление контестами</h1>
            <button
              className="coach-btn coach-btn-primary"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Отменить' : '+ Создать контест'}
            </button>
          </div>
        </div>

        {error && (
          <div className="coach-error-banner">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {showCreateForm && (
          <div className="coach-form-card">
            <h2>Новый контест</h2>
            <form onSubmit={handleCreateContest} className="coach-form">
              <div className="coach-form-group">
                <label htmlFor="contest-name">Название</label>
                <input
                  id="contest-name"
                  type="text"
                  value={newContest.name}
                  onChange={(e) => setNewContest({ ...newContest, name: e.target.value })}
                  required
                  placeholder="Codeforces Round #123"
                />
              </div>

              <div className="coach-form-group">
                <label htmlFor="contest-platform">Платформа</label>
                <select
                  id="contest-platform"
                  value={newContest.platform}
                  onChange={(e) => setNewContest({ ...newContest, platform: e.target.value })}
                >
                  <option value="codeforces">Codeforces</option>
                  <option value="atcoder">AtCoder</option>
                  <option value="custom">Другая</option>
                </select>
              </div>

              <div className="coach-form-group">
                <label htmlFor="contest-start">Время начала</label>
                <input
                  id="contest-start"
                  type="datetime-local"
                  value={newContest.start_time}
                  onChange={(e) => setNewContest({ ...newContest, start_time: e.target.value })}
                  required
                />
              </div>

              <div className="coach-form-group">
                <label htmlFor="contest-duration">Длительность (минуты)</label>
                <input
                  id="contest-duration"
                  type="number"
                  value={newContest.duration}
                  onChange={(e) => setNewContest({ ...newContest, duration: e.target.value })}
                  required
                  placeholder="120"
                  min="1"
                />
              </div>

              <button type="submit" className="coach-btn coach-btn-primary">
                Создать
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="coach-loading-inner">Загрузка контестов...</div>
        ) : (
          <div className="coach-contests-list">
            <h2>Существующие контесты</h2>
            {contests.length === 0 ? (
              <div className="coach-empty">
                <p>Контесты не найдены</p>
              </div>
            ) : (
              <div className="coach-contests-grid">
                {contests.map((contest) => (
                  <div key={contest.id} className="coach-contest-card">
                    <div className="coach-contest-header">
                      <h3>{contest.name}</h3>
                      <span className={`coach-contest-status coach-contest-status-${contest.status}`}>
                        {contest.status === 'upcoming' && '🔜 Предстоящий'}
                        {contest.status === 'active' && '🔴 Активный'}
                        {contest.status === 'completed' && '✅ Завершённый'}
                      </span>
                    </div>
                    <div className="coach-contest-info">
                      <p><strong>Платформа:</strong> {contest.platform}</p>
                      <p><strong>Начало:</strong> {new Date(contest.start_time).toLocaleString('ru-RU')}</p>
                      <p><strong>Длительность:</strong> {contest.duration} мин</p>
                    </div>
                    <div className="coach-contest-actions">
                      <button className="coach-action-btn coach-btn-edit" title="Редактировать">
                        ✏️
                      </button>
                      <button
                        className="coach-action-btn coach-btn-delete"
                        title="Удалить"
                        onClick={() => handleDeleteContest(contest.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
