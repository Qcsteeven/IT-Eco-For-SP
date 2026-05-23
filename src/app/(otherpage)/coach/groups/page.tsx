'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import PreviousPageLink from '@/components/PreviousPageLink';
import { useRouter } from 'next/navigation';
import { Archive, BarChart3, Plus, Search, UsersRound, X } from 'lucide-react';
import '../coach.scss';

type Group = {
  id: unknown;
  name: string;
  description?: string;
  is_archived?: boolean;
  created_at?: string;
};

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
};

const EMPTY_FORM = { name: '', description: '' };

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function recordId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return safeDecode(value);

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tb === 'string' && record.id != null) {
      return `${record.tb}:${String(record.id)}`;
    }

    if (record.id != null) return recordId(record.id);
  }

  return String(value);
}

function groupPath(id: string) {
  return encodeURIComponent(id);
}

function groupTitle(group: Group) {
  return group.name?.trim() || 'Без названия';
}

export default function CoachGroupsPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('coach');
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/groups', { cache: 'no-store' });
      const payload = (await response.json()) as ApiResponse<Group[]>;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не удалось загрузить группы');
      }

      setGroups(payload.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить группы',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;

    return groups.filter((group) => {
      const title = groupTitle(group).toLowerCase();
      const description = (group.description || '').toLowerCase();
      return title.includes(query) || description.includes(query);
    });
  }, [groups, search]);

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  useEffect(() => {
    if (authorized) fetchGroups();
  }, [authorized, fetchGroups]);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          description: createForm.description.trim(),
        }),
      });
      const payload = (await response.json()) as ApiResponse<Group>;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не удалось создать группу');
      }

      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      setSuccess('Группа создана');
      await fetchGroups();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось создать группу',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function archiveGroup(groupId: string) {
    if (!window.confirm('Архивировать группу?')) return;

    try {
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/groups/${groupPath(groupId)}`, {
        method: 'DELETE',
      });
      const payload = (await response.json()) as ApiResponse<Group>;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не удалось архивировать группу');
      }

      setSuccess('Группа архивирована');
      await fetchGroups();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось архивировать группу',
      );
    }
  }

  if (status === 'loading' || isLoading) {
    return <div className="coach-loading">Загрузка...</div>;
  }

  if (!authorized) {
    return (
      <div className="coach-access-denied">
        <h1>Доступ запрещен</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/coach">Вернуться</Link>
      </div>
    );
  }

  return (
    <main className="coach-page">
      <div className="coach-container">
        <header className="coach-header">
          <PreviousPageLink fallbackHref="/coach" className="coach-back-link" />
          <div className="coach-header-content">
            <div>
              <p className="coach-eyebrow">Тренерская панель</p>
              <h1>Группы</h1>
            </div>
            <button
              type="button"
              className="coach-btn coach-btn--primary"
              onClick={() => {
                setShowCreate((current) => !current);
                setError(null);
                setSuccess(null);
              }}
            >
              <Plus aria-hidden="true" size={18} />
              {showCreate ? 'Скрыть форму' : 'Создать группу'}
            </button>
          </div>
        </header>

        {error && (
          <div className="coach-banner coach-banner--error">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Скрыть ошибку"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="coach-banner coach-banner--success">
            {success}
            <button
              type="button"
              onClick={() => setSuccess(null)}
              aria-label="Скрыть сообщение"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
        )}

        {showCreate && (
          <section className="coach-form-card" aria-labelledby="create-group">
            <h2 id="create-group">Новая группа</h2>
            <form onSubmit={createGroup} className="coach-form">
              <label className="coach-form-group">
                <span>Название</span>
                <input
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  placeholder="Например: Алгоритмы 2026"
                />
              </label>

              <label className="coach-form-group">
                <span>Описание</span>
                <textarea
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Короткое описание группы"
                />
              </label>

              <div className="coach-form-actions">
                <button
                  type="button"
                  className="coach-btn coach-btn--secondary"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateForm(EMPTY_FORM);
                  }}
                >
                  Отменить
                </button>
                <button
                  type="submit"
                  className="coach-btn coach-btn--primary"
                  disabled={submitting}
                >
                  {submitting ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="coach-panel">
          <div className="coach-toolbar">
            <label className="coach-search">
              <Search aria-hidden="true" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по названию или описанию"
              />
            </label>

            <div className="coach-stats-pills">
              <span>Всего: {groups.length}</span>
              <span>Показано: {filteredGroups.length}</span>
            </div>
          </div>

          {loading ? (
            <div className="coach-loading-inner">Загрузка групп...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="coach-empty">
              <p>Группы не найдены</p>
            </div>
          ) : (
            <div className="coach-group-grid">
              {filteredGroups.map((group) => {
                const id = recordId(group.id);

                return (
                  <article key={id} className="coach-group-card">
                    <div className="coach-group-card__icon">
                      <UsersRound aria-hidden="true" size={28} />
                    </div>
                    <div className="coach-group-card__body">
                      <h2>{groupTitle(group)}</h2>
                      <p>{group.description || 'Описание пока не добавлено'}</p>
                    </div>
                    <div className="coach-card-actions">
                      <Link
                        className="coach-icon-btn coach-icon-btn--primary"
                        href={`/coach/groups/${groupPath(id)}`}
                        title="Открыть группу"
                        aria-label={`Открыть группу ${groupTitle(group)}`}
                      >
                        <UsersRound aria-hidden="true" size={20} />
                      </Link>
                      <Link
                        className="coach-icon-btn coach-icon-btn--secondary"
                        href={`/coach/groups/${groupPath(id)}/analytics`}
                        title="Аналитика"
                        aria-label={`Аналитика группы ${groupTitle(group)}`}
                      >
                        <BarChart3 aria-hidden="true" size={20} />
                      </Link>
                      <button
                        type="button"
                        className="coach-icon-btn coach-icon-btn--danger"
                        onClick={() => archiveGroup(id)}
                        title="Архивировать"
                        aria-label={`Архивировать группу ${groupTitle(group)}`}
                      >
                        <Archive aria-hidden="true" size={20} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
