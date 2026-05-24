'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import PreviousPageLink from '@/components/PreviousPageLink';
import { useParams, useRouter } from 'next/navigation';
import {
  BarChart3,
  Save,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import '../../coach.scss';

type Group = {
  id: unknown;
  name: string;
  description?: string;
};

type Member = {
  user_id: unknown;
  full_name?: string;
  email?: string;
  joined_at?: string;
};

type User = {
  id: unknown;
  full_name?: string;
  email: string;
};

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
};

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

function normalizeUserId(value: unknown) {
  const raw = recordId(value);
  return raw.startsWith('users:') ? raw : `users:${raw}`;
}

function groupPath(id: string) {
  return encodeURIComponent(id);
}

function displayName(user: { full_name?: string; email?: string }) {
  return user.full_name?.trim() || user.email || 'Без имени';
}

export default function CoachGroupDetailsPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('coach');
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const groupId = typeof params?.id === 'string' ? safeDecode(params.id) : '';

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [groupResponse, membersResponse, usersResponse] = await Promise.all(
        [
          fetch(`/api/groups/${groupPath(groupId)}`, { cache: 'no-store' }),
          fetch(`/api/groups/${groupPath(groupId)}/members`, {
            cache: 'no-store',
          }),
          fetch('/api/users?limit=200', { cache: 'no-store' }),
        ],
      );

      const groupPayload = (await groupResponse.json()) as ApiResponse<Group>;
      const membersPayload = (await membersResponse.json()) as ApiResponse<
        Member[]
      >;
      const usersPayload = (await usersResponse.json()) as ApiResponse<User[]>;

      if (!groupResponse.ok || !groupPayload.ok) {
        throw new Error(groupPayload.error || 'Не удалось загрузить группу');
      }
      if (!membersResponse.ok || !membersPayload.ok) {
        throw new Error(
          membersPayload.error || 'Не удалось загрузить участников',
        );
      }
      if (!usersResponse.ok || !usersPayload.ok) {
        throw new Error(
          usersPayload.error || 'Не удалось загрузить пользователей',
        );
      }

      const loadedGroup = groupPayload.data || null;
      setGroup(loadedGroup);
      setMembers(membersPayload.data || []);
      setUsers(usersPayload.data || []);
      setSelected({});
      setEditForm({
        name: loadedGroup?.name || '',
        description: loadedGroup?.description || '',
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить группу',
      );
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (authorized && groupId) fetchAll();
  }, [authorized, fetchAll, groupId]);

  const normalizedMembers = useMemo(
    () =>
      members.map((member) => ({
        ...member,
        user_id: normalizeUserId(member.user_id),
      })),
    [members],
  );

  const normalizedUsers = useMemo(
    () =>
      users.map((user) => ({
        ...user,
        id: normalizeUserId(user.id),
      })),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const memberIds = new Set(
      normalizedMembers.map((member) => member.user_id),
    );
    const availableUsers = normalizedUsers.filter(
      (user) => !memberIds.has(user.id),
    );

    if (!query) return availableUsers;

    return availableUsers.filter((user) => {
      const name = (user.full_name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [normalizedMembers, normalizedUsers, search]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/groups/${groupPath(groupId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim(),
        }),
      });
      const payload = (await response.json()) as ApiResponse<Group>;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не удалось обновить группу');
      }

      setGroup(payload.data || group);
      setSuccess('Группа обновлена');
      await fetchAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось обновить группу',
      );
    } finally {
      setSaving(false);
    }
  }

  async function addSelected() {
    if (selectedIds.length === 0) return;

    try {
      setAdding(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        `/api/groups/${groupPath(groupId)}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: selectedIds }),
        },
      );
      const payload = (await response.json()) as ApiResponse<unknown>;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не удалось добавить участников');
      }

      setSuccess('Участники добавлены');
      await fetchAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось добавить участников',
      );
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(userId: string) {
    if (!window.confirm('Удалить участника из группы?')) return;

    try {
      setError(null);
      setSuccess(null);

      const response = await fetch(
        `/api/groups/${groupPath(groupId)}/members`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        },
      );
      const payload = (await response.json()) as ApiResponse<unknown>;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не удалось удалить участника');
      }

      setSuccess('Участник удален');
      await fetchAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось удалить участника',
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
          <PreviousPageLink
            fallbackHref="/coach/groups"
            className="coach-back-link"
          >
            Назад к группам
          </PreviousPageLink>
          <div className="coach-header-content">
            <div>
              <p className="coach-eyebrow">Редактирование группы</p>
              <h1>{group?.name || 'Группа'}</h1>
            </div>
            {groupId && (
              <Link
                className="coach-btn coach-btn--secondary"
                href={`/coach/groups/${groupPath(groupId)}/analytics`}
              >
                <BarChart3 aria-hidden="true" size={18} />
                Аналитика
              </Link>
            )}
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

        {loading ? (
          <div className="coach-loading-inner">Загрузка группы...</div>
        ) : (
          <>
            <section className="coach-form-card" aria-labelledby="group-edit">
              <h2 id="group-edit">Основная информация</h2>
              <form onSubmit={saveGroup} className="coach-form">
                <label className="coach-form-group">
                  <span>Название</span>
                  <input
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                    placeholder="Название группы"
                  />
                </label>

                <label className="coach-form-group">
                  <span>Описание</span>
                  <textarea
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Описание группы"
                  />
                </label>

                <div className="coach-form-actions">
                  <button
                    type="submit"
                    className="coach-btn coach-btn--primary"
                    disabled={saving}
                  >
                    <Save aria-hidden="true" size={18} />
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </form>
            </section>

            <section className="coach-panel">
              <div className="coach-panel-heading">
                <span className="coach-panel-icon">
                  <UsersRound aria-hidden="true" size={24} />
                </span>
                <div>
                  <h2>Состав группы</h2>
                  <p>{normalizedMembers.length} участников</p>
                </div>
              </div>

              {normalizedMembers.length === 0 ? (
                <div className="coach-empty">
                  <p>В группе пока нет участников</p>
                </div>
              ) : (
                <div className="coach-table-wrap">
                  <table className="coach-table">
                    <thead>
                      <tr>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedMembers.map((member) => (
                        <tr key={member.user_id}>
                          <td>{displayName(member)}</td>
                          <td>{member.email || '-'}</td>
                          <td>
                            <button
                              type="button"
                              className="coach-icon-btn coach-icon-btn--danger"
                              onClick={() => removeMember(member.user_id)}
                              title="Удалить"
                              aria-label={`Удалить ${displayName(member)}`}
                            >
                              <Trash2 aria-hidden="true" size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="coach-panel">
              <div className="coach-toolbar">
                <label className="coach-search">
                  <Search aria-hidden="true" size={18} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Поиск по имени или email"
                  />
                </label>

                <button
                  type="button"
                  className="coach-btn coach-btn--primary"
                  onClick={addSelected}
                  disabled={adding || selectedIds.length === 0}
                >
                  <UserPlus aria-hidden="true" size={18} />
                  {adding
                    ? 'Добавление...'
                    : `Добавить выбранных: ${selectedIds.length}`}
                </button>
              </div>

              <div className="coach-table-wrap coach-table-wrap--compact">
                <table className="coach-table">
                  <thead>
                    <tr>
                      <th>Выбор</th>
                      <th>Имя</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <input
                            className="coach-checkbox"
                            type="checkbox"
                            checked={!!selected[user.id]}
                            onChange={(event) =>
                              setSelected((current) => ({
                                ...current,
                                [user.id]: event.target.checked,
                              }))
                            }
                          />
                        </td>
                        <td>{displayName(user)}</td>
                        <td>{user.email}</td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={3}>Нет пользователей для добавления</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
