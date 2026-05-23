'use client';

import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import Link from 'next/link';
import PreviousPageLink from '@/components/PreviousPageLink';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import './karma.scss';

interface User {
  id: string;
  email: string;
  full_name: string;
  codeforces_karma?: number;
}

interface KarmaLog {
  id: string;
  user_email: string;
  amount: number;
  reason: string;
  date: string;
}

export default function AdminKarmaPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('admin');
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [karmaLogs, setKarmaLogs] = useState<KarmaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [karmaAmount, setKarmaAmount] = useState('');
  const [karmaReason, setKarmaReason] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  useEffect(() => {
    if (authorized) {
      fetchData();
    }
  }, [authorized]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, logsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/karma'),
      ]);

      const usersData = await usersRes.json();
      const logsData = await logsRes.json();

      if (usersData.ok) {
        setUsers(usersData.data);
      }

      if (logsData.ok && Array.isArray(logsData.data)) {
        setKarmaLogs(
          logsData.data.map((log: KarmaLog, idx: number) => ({
            ...log,
            id: log.id || `log-${idx}`,
          }))
        );
      }
    } catch (err) {
      setError('Не удалось загрузить данные');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKarmaAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedUserId || karmaAmount.trim() === '') {
      setError('Выберите пользователя и укажите сумму');
      return;
    }

    const amountNum = parseInt(karmaAmount, 10);
    if (Number.isNaN(amountNum)) {
      setError('Укажите целое число для изменения кармы');
      return;
    }

    try {
      const res = await fetch('/api/admin/karma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          amount: amountNum,
          reason: karmaReason || 'Ручная корректировка',
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess(`Карма успешно обновлена: ${data.data.previousKarma} → ${data.data.newKarma}`);
        setSelectedUserId('');
        setKarmaAmount('');
        setKarmaReason('');
        setShowForm(false);
        await fetchData();
      } else {
        setError(data.error || 'Ошибка корректировки кармы');
      }
    } catch (err) {
      setError('Не удалось скорректировать карму');
      console.error(err);
    }
  };

  if (status === 'loading' || isLoading) {
    return <div className="karma-loading">Загрузка...</div>;
  }

  if (!authorized) {
    return (
      <div className="karma-access-denied">
        <h1>Доступ запрещён</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/admin">Вернуться в панель администратора</Link>
      </div>
    );
  }

  return (
    <div className="karma-page">
      <div className="karma-container">
        <div className="karma-header">
          <PreviousPageLink fallbackHref="/admin" className="karma-back-link" />
          <h1>Корректировка кармы</h1>
        </div>

        {error && (
          <div className="karma-error-banner">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {success && (
          <div className="karma-success-banner">
            {success}
            <button onClick={() => setSuccess(null)}>✕</button>
          </div>
        )}

        <div className="karma-actions">
          <button
            className="karma-btn karma-btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Отменить' : '+ Скорректировать карму'}
          </button>
        </div>

        {showForm && (
          <div className="karma-form-card">
            <h2>Новая корректировка</h2>
            <form onSubmit={handleKarmaAdjustment} className="karma-form">
              <div className="karma-form-group">
                <label htmlFor="karma-user">Пользователь</label>
                <select
                  id="karma-user"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                >
                  <option value="">Выберите пользователя</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email} {user.full_name ? `(${user.full_name})` : ''} — Карма:{' '}
                      {user.codeforces_karma ?? 0}
                    </option>
                  ))}
                </select>
              </div>

              <div className="karma-form-group">
                <label htmlFor="karma-amount">Изменение кармы</label>
                <input
                  id="karma-amount"
                  type="number"
                  value={karmaAmount}
                  onChange={(e) => setKarmaAmount(e.target.value)}
                  required
                  placeholder="+50 или -20"
                />
                <small>Положительное число для увеличения, отрицательное для уменьшения</small>
              </div>

              <div className="karma-form-group">
                <label htmlFor="karma-reason">Причина</label>
                <input
                  id="karma-reason"
                  type="text"
                  value={karmaReason}
                  onChange={(e) => setKarmaReason(e.target.value)}
                  placeholder="Участие в офлайн-мероприятии"
                />
              </div>

              <button type="submit" className="karma-btn karma-btn-primary">
                Применить
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="karma-loading-inner">Загрузка...</div>
        ) : (
          <div className="karma-section">
            <h2>История изменений кармы</h2>
            {karmaLogs.length === 0 ? (
              <div className="karma-empty">
                <p>Записи изменений кармы не найдены</p>
              </div>
            ) : (
              <div className="karma-logs-table">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Изменение</th>
                      <th>Причина</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {karmaLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.user_email}</td>
                        <td>
                          <span className={`karma-value karma-${log.amount >= 0 ? 'positive' : 'negative'}`}>
                            {log.amount >= 0 ? '+' : ''}{log.amount}
                          </span>
                        </td>
                        <td>{log.reason}</td>
                        <td>{new Date(log.date).toLocaleString('ru-RU')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
