'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Pencil, X } from 'lucide-react';
import { useRoleGuard } from '@/lib/rbac/client';
import './karma.scss';

interface User {
  id: string;
  email: string;
  full_name: string;
  karma?: number;
  bscp_rating?: number;
}

interface KarmaLog {
  id: string;
  user_email: string;
  user_name?: string;
  amount: number;
  reason: string;
  date: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('ru-RU');
}

function displayKarma(user: User) {
  return Number(user.karma ?? user.bscp_rating ?? 0);
}

export default function AdminKarmaPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('admin');
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [karmaLogs, setKarmaLogs] = useState<KarmaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, logsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/karma'),
      ]);

      const usersData = (await usersRes.json()) as ApiResponse<User[]>;
      const logsData = (await logsRes.json()) as ApiResponse<KarmaLog[]>;

      if (!usersData.ok) {
        throw new Error(
          usersData.error || 'Не удалось загрузить пользователей',
        );
      }

      if (!logsData.ok) {
        throw new Error(logsData.error || 'Не удалось загрузить историю кармы');
      }

      setUsers(usersData.data || []);
      setKarmaLogs(logsData.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить данные',
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedUserId('');
    setKarmaAmount('');
    setKarmaReason('');
  }

  function closeForm() {
    setShowForm(false);
    setSubmitting(false);
    resetForm();
  }

  async function handleKarmaAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const amount = Number(karmaAmount);
    if (!selectedUserId || !Number.isFinite(amount) || amount === 0) {
      setError('Выберите пользователя и укажите ненулевое изменение кармы');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/karma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          amount,
          reason: karmaReason.trim() || 'Ручная корректировка',
        }),
      });

      const data = (await res.json()) as ApiResponse<{
        previousKarma: number;
        newKarma: number;
      }>;

      if (!data.ok) {
        throw new Error(data.error || 'Ошибка корректировки кармы');
      }

      setSuccess(
        `Карма обновлена: ${data.data?.previousKarma ?? 0} -> ${data.data?.newKarma ?? 0}`,
      );
      closeForm();
      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось скорректировать карму',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading' || isLoading) {
    return <div className="karma-loading">Загрузка...</div>;
  }

  if (!authorized) {
    return (
      <div className="karma-access-denied">
        <h1>Доступ запрещен</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/admin">Вернуться в панель администратора</Link>
      </div>
    );
  }

  return (
    <main className={`karma-page ${showForm ? 'karma-page--with-form' : ''}`}>
      <div className="karma-container">
        <header className="karma-header">
          <Link href="/admin" className="karma-back-link">
            Назад в панель
          </Link>
          <h1>Корректировка кармы</h1>
        </header>

        {error && (
          <div className="karma-banner karma-banner--error">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Скрыть ошибку"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="karma-banner karma-banner--success">
            {success}
            <button
              type="button"
              onClick={() => setSuccess(null)}
              aria-label="Скрыть сообщение"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {showForm ? (
          <form className="karma-form-card" onSubmit={handleKarmaAdjustment}>
            <h2>Новое изменение кармы</h2>

            <div className="karma-form">
              <label className="karma-form-group" htmlFor="karma-user">
                <span>Пользователь</span>
                <select
                  id="karma-user"
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  required
                >
                  <option value="">Выберите пользователя</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email}
                      {user.full_name ? ` (${user.full_name})` : ''} - карма:{' '}
                      {displayKarma(user)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedUser && (
                <p className="karma-current-value">
                  Текущее значение: {displayKarma(selectedUser)}
                </p>
              )}

              <label className="karma-form-group" htmlFor="karma-amount">
                <span>Изменение кармы</span>
                <input
                  id="karma-amount"
                  type="number"
                  value={karmaAmount}
                  onChange={(event) => setKarmaAmount(event.target.value)}
                  required
                  placeholder="+50 или -20"
                />
                <small>
                  Положительное число для увеличения, отрицательное для
                  уменьшения
                </small>
              </label>

              <label className="karma-form-group" htmlFor="karma-reason">
                <span>Причина</span>
                <textarea
                  id="karma-reason"
                  value={karmaReason}
                  onChange={(event) => setKarmaReason(event.target.value)}
                  placeholder="Участие в офлайн-мероприятии"
                  rows={5}
                />
              </label>
            </div>

            <div className="karma-form-actions">
              <button
                type="button"
                className="karma-form-btn karma-form-btn--cancel"
                onClick={closeForm}
              >
                Отменить
              </button>
              <button
                type="submit"
                className="karma-form-btn karma-form-btn--save"
                disabled={submitting}
              >
                {submitting ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="karma-open-form-btn"
            onClick={() => {
              setShowForm(true);
              setError(null);
              setSuccess(null);
            }}
          >
            <Pencil size={18} aria-hidden="true" />
            Изменить карму
          </button>
        )}

        <section
          className="karma-history"
          aria-labelledby="karma-history-title"
        >
          <h2 id="karma-history-title">История изменений кармы</h2>

          {loading ? (
            <div className="karma-loading-inner">Загрузка...</div>
          ) : karmaLogs.length === 0 ? (
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
                      <td>
                        {log.user_email ? (
                          <a href={`mailto:${log.user_email}`}>
                            {log.user_email}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <span
                          className={`karma-value ${
                            log.amount >= 0
                              ? 'karma-positive'
                              : 'karma-negative'
                          }`}
                        >
                          {log.amount >= 0 ? '+' : ''}
                          {log.amount}
                        </span>
                      </td>
                      <td>{log.reason}</td>
                      <td>{formatDate(log.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
