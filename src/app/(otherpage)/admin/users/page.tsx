'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  CheckCircle2,
  CircleOff,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useRoleGuard } from '@/lib/rbac/client';
import PreviousPageLink from '@/components/PreviousPageLink';
import './users.scss';

type UserRole = 'guest' | 'user' | 'coach' | 'admin';
type FormMode = 'create' | 'edit' | null;

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  is_verified: boolean;
  is_blocked: boolean;
  registration_date: string;
  bscp_rating: number;
}

interface UserForm {
  email: string;
  full_name: string;
  phone: string;
  password: string;
  role: UserRole;
  is_verified: boolean;
  is_blocked: boolean;
  bscp_rating: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const EMPTY_FORM: UserForm = {
  email: '',
  full_name: '',
  phone: '',
  password: '',
  role: 'user',
  is_verified: true,
  is_blocked: false,
  bscp_rating: '0',
};

const ROLE_LABELS: Record<UserRole, string> = {
  guest: 'Гость',
  user: 'Участник',
  coach: 'Тренер',
  admin: 'Администратор',
};

function normalizeRole(role: string): UserRole {
  return ['guest', 'user', 'coach', 'admin'].includes(role)
    ? (role as UserRole)
    : 'user';
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ru-RU');
}

export default function AdminUsersPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('admin');
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  useEffect(() => {
    if (authorized) {
      fetchUsers();
    }
  }, [authorized]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) =>
      `${user.email} ${user.full_name} ${user.phone} ${ROLE_LABELS[user.role]}`
        .toLowerCase()
        .includes(query),
    );
  }, [searchQuery, users]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => !user.is_blocked).length,
      blocked: users.filter((user) => user.is_blocked).length,
      verified: users.filter((user) => user.is_verified).length,
    }),
    [users],
  );

  async function fetchUsers() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/users');
      const data = (await res.json()) as ApiResponse<User[]>;

      if (!data.ok) {
        throw new Error(data.error || 'Ошибка загрузки пользователей');
      }

      setUsers(
        (data.data || []).map((user) => ({
          ...user,
          role: normalizeRole(user.role),
          bscp_rating: Number(user.bscp_rating || 0),
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить пользователей',
      );
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormMode('create');
    setError(null);
    setSuccess(null);
  }

  function openEditForm(user: User) {
    setEditingUser(user);
    setForm({
      email: user.email,
      full_name: user.full_name,
      phone: user.phone || '',
      password: '',
      role: normalizeRole(user.role),
      is_verified: user.is_verified,
      is_blocked: user.is_blocked,
      bscp_rating: String(user.bscp_rating || 0),
    });
    setFormMode('edit');
    setError(null);
    setSuccess(null);
  }

  function closeForm() {
    setFormMode(null);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setSubmitting(false);
  }

  function updateForm<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formMode) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload: Partial<UserForm> = {
      ...form,
      email: form.email.trim(),
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      bscp_rating: form.bscp_rating.trim() || '0',
    };

    if (formMode === 'edit' && !payload.password?.trim()) {
      delete payload.password;
    }

    try {
      const endpoint =
        formMode === 'create'
          ? '/api/admin/users'
          : `/api/admin/users/${encodeURIComponent(editingUser?.id ?? '')}`;
      const method = formMode === 'create' ? 'POST' : 'PATCH';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as ApiResponse<User>;
      if (!data.ok) {
        throw new Error(data.error || 'Не удалось сохранить пользователя');
      }

      setSuccess(
        formMode === 'create' ? 'Пользователь создан' : 'Пользователь обновлен',
      );
      closeForm();
      await fetchUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось сохранить пользователя',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUser) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(deleteUser.id)}`,
        {
          method: 'DELETE',
        },
      );
      const data = (await res.json()) as ApiResponse<null>;
      if (!data.ok) {
        throw new Error(data.error || 'Не удалось удалить пользователя');
      }

      setSuccess('Пользователь удален');
      setDeleteUser(null);
      await fetchUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось удалить пользователя',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading' || isLoading) {
    return <div className="users-loading">Загрузка...</div>;
  }

  if (!authorized) {
    return (
      <div className="users-access-denied">
        <h1>Доступ запрещен</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/admin">Вернуться в панель администратора</Link>
      </div>
    );
  }

  return (
    <section className="users-page">
      <div className="users-container">
        <header className="users-header">
          <div>
            <PreviousPageLink fallbackHref="/admin" className="users-back-link">
              Назад в панель
            </PreviousPageLink>
            <h1>Управление пользователями</h1>
          </div>
          <button
            type="button"
            className="users-primary-btn"
            onClick={openCreateForm}
          >
            <UserPlus size={20} />
            Создать пользователя
          </button>
        </header>

        <div className="users-toolbar">
          <label className="users-search">
            <Search size={20} aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск по email, имени, телефону или роли"
              type="search"
            />
          </label>
          <div className="users-stats" aria-label="Статистика пользователей">
            <span>Всего: {stats.total}</span>
            <span>Активны: {stats.active}</span>
            <span>Заблокированы: {stats.blocked}</span>
            <span>Подтверждены: {stats.verified}</span>
          </div>
        </div>

        {error && (
          <div className="users-error">
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
          <div className="users-success">
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

        {formMode && (
          <form className="users-form-card" onSubmit={handleSaveUser}>
            <h2>
              {formMode === 'create'
                ? 'Создание пользователя'
                : 'Редактирование пользователя'}
            </h2>

            <div className="users-form-grid">
              <label className="users-form-group">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm('email', event.target.value)}
                  required
                  placeholder="example@mail.com"
                />
              </label>

              <label className="users-form-group">
                <span>Имя</span>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(event) =>
                    updateForm('full_name', event.target.value)
                  }
                  required
                  placeholder="Иванов Иван"
                />
              </label>

              <label className="users-form-group">
                <span>Телефон</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateForm('phone', event.target.value)}
                  placeholder="+7 (999) 999 99 99"
                />
              </label>

              <label className="users-form-group">
                <span>Пароль</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    updateForm('password', event.target.value)
                  }
                  required={formMode === 'create'}
                  placeholder={
                    formMode === 'create'
                      ? 'Минимум 6 символов'
                      : 'Оставьте пустым'
                  }
                />
              </label>

              <label className="users-form-group">
                <span>Роль</span>
                <select
                  value={form.role}
                  onChange={(event) =>
                    updateForm('role', event.target.value as UserRole)
                  }
                >
                  <option value="user">Участник</option>
                  <option value="coach">Тренер</option>
                  <option value="admin">Администратор</option>
                  <option value="guest">Гость</option>
                </select>
              </label>

              <label className="users-form-group">
                <span>Рейтинг</span>
                <input
                  type="number"
                  value={form.bscp_rating}
                  onChange={(event) =>
                    updateForm('bscp_rating', event.target.value)
                  }
                  placeholder="0"
                />
              </label>

              <label className="users-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_verified}
                  onChange={(event) =>
                    updateForm('is_verified', event.target.checked)
                  }
                />
                <span>Аккаунт подтвержден</span>
              </label>

              <label className="users-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_blocked}
                  onChange={(event) =>
                    updateForm('is_blocked', event.target.checked)
                  }
                />
                <span>Аккаунт заблокирован</span>
              </label>
            </div>

            <div className="users-form-actions">
              <button
                type="button"
                className="users-form-btn users-form-btn--cancel"
                onClick={closeForm}
              >
                Отменить
              </button>
              <button
                type="submit"
                className="users-form-btn users-form-btn--save"
                disabled={submitting}
              >
                {submitting ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        )}

        <div className="users-table-wrapper">
          {loading ? (
            <div className="users-loading-inner">Загрузка пользователей...</div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Подтверждение</th>
                  <th>Статус</th>
                  <th>Рейтинг</th>
                  <th>Дата регистрации</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.full_name || '-'}</td>
                    <td>
                      <span className={`user-role user-role-${user.role}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`user-verified ${user.is_verified ? 'verified' : 'not-verified'}`}
                        aria-label={
                          user.is_verified
                            ? 'Подтвержден администратором'
                            : 'Ожидает подтверждения'
                        }
                        title={
                          user.is_verified
                            ? 'Подтвержден администратором'
                            : 'Ожидает подтверждения'
                        }
                      >
                        {user.is_verified ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <X size={18} />
                        )}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`user-status ${user.is_blocked ? 'is-blocked' : 'is-active'}`}
                      >
                        {user.is_blocked ? (
                          <CircleOff size={16} />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        {user.is_blocked ? 'Заблокирован' : 'Активен'}
                      </span>
                    </td>
                    <td>{user.bscp_rating || 0}</td>
                    <td>{formatDate(user.registration_date)}</td>
                    <td className="users-actions">
                      <button
                        type="button"
                        className="user-action-btn edit-btn"
                        aria-label={`Редактировать ${user.email}`}
                        onClick={() => openEditForm(user)}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        type="button"
                        className="user-action-btn delete-btn"
                        aria-label={`Удалить ${user.email}`}
                        onClick={() => setDeleteUser(user)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="users-empty">
              <p>Пользователи не найдены</p>
            </div>
          )}
        </div>
      </div>

      {deleteUser && (
        <div
          className="users-modal-overlay"
          onClick={() => setDeleteUser(null)}
        >
          <div
            className="users-modal users-modal--small"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="users-modal-header">
              <h2>Удалить пользователя?</h2>
              <button
                type="button"
                onClick={() => setDeleteUser(null)}
                aria-label="Закрыть форму"
              >
                <X size={20} />
              </button>
            </div>
            <p className="users-modal-text">
              Пользователь {deleteUser.email} будет удален из системы.
            </p>
            <div className="users-form-actions">
              <button
                type="button"
                className="users-form-btn users-form-btn--cancel"
                onClick={() => setDeleteUser(null)}
              >
                Отменить
              </button>
              <button
                type="button"
                className="users-form-btn users-form-btn--delete"
                onClick={handleDeleteUser}
                disabled={submitting}
              >
                {submitting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
