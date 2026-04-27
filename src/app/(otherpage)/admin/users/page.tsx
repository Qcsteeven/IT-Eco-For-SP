'use client';

import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import './users.scss';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_verified: boolean;
  registration_date: string;
}

export default function AdminUsersPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('admin');
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<User | null>(null);
  const [editRole, setEditRole] = useState('');

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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      const data = await res.json();

      if (data.ok) {
        setUsers(data.data);
      } else {
        setError(data.error || 'Ошибка загрузки пользователей');
      }
    } catch (err) {
      setError('Не удалось загрузить пользователей');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      setError(null);
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editRole }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess('Роль пользователя успешно обновлена');
        setEditingUser(null);
        await fetchUsers();
      } else {
        setError(data.error || 'Ошибка обновления роли');
      }
    } catch (err) {
      setError('Не удалось обновить роль пользователя');
      console.error(err);
    }
  };

  const handleDeleteClick = (user: User) => {
    setShowDeleteModal(user);
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteModal) return;

    if (!confirm(`Вы уверены, что хотите удалить пользователя ${showDeleteModal.email}?`)) {
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/admin/users/${showDeleteModal.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess('Пользователь успешно удалён');
        setShowDeleteModal(null);
        await fetchUsers();
      } else {
        setError(data.error || 'Ошибка удаления пользователя');
      }
    } catch (err) {
      setError('Не удалось удалить пользователя');
      console.error(err);
    }
  };

  if (status === 'loading' || isLoading) {
    return <div className="users-loading">Загрузка...</div>;
  }

  if (!authorized) {
    return (
      <div className="users-access-denied">
        <h1>Доступ запрещён</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/admin">Вернуться в панель администратора</Link>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="users-container">
        <div className="users-header">
          <Link href="/admin" className="users-back-link">← Назад</Link>
          <h1>Управление пользователями</h1>
        </div>

        {error && (
          <div className="users-error">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {success && (
          <div className="users-success">
            {success}
            <button onClick={() => setSuccess(null)}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="users-loading-inner">Загрузка пользователей...</div>
        ) : (
          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Верификация</th>
                  <th>Дата регистрации</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.full_name || '—'}</td>
                    <td>
                      <span className={`user-role user-role-${user.role}`}>
                        {user.role === 'admin' && 'Администратор'}
                        {user.role === 'coach' && 'Тренер'}
                        {user.role === 'user' && 'Участник'}
                        {user.role === 'guest' && 'Гость'}
                      </span>
                    </td>
                    <td>
                      <span className={`user-verified ${user.is_verified ? 'verified' : 'not-verified'}`}>
                        {user.is_verified ? '✓ Да' : '✗ Нет'}
                      </span>
                    </td>
                    <td>
                      {new Date(user.registration_date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="users-actions">
                      <button
                        className="user-action-btn edit-btn"
                        title="Редактировать"
                        onClick={() => handleEditClick(user)}
                      >
                        ✏️
                      </button>
                      <button
                        className="user-action-btn delete-btn"
                        title="Удалить"
                        onClick={() => handleDeleteClick(user)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="users-empty">
                <p>Пользователи не найдены</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="users-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="users-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Редактировать пользователя</h2>
            <div className="users-modal-form">
              <div className="users-modal-group">
                <label>Email</label>
                <input type="text" value={editingUser.email} disabled />
              </div>
              <div className="users-modal-group">
                <label>Имя</label>
                <input type="text" value={editingUser.full_name || '—'} disabled />
              </div>
              <div className="users-modal-group">
                <label>Роль</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="user">Участник</option>
                  <option value="coach">Тренер</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
            </div>
            <div className="users-modal-actions">
              <button
                className="users-modal-btn users-modal-btn-cancel"
                onClick={() => setEditingUser(null)}
              >
                Отмена
              </button>
              <button
                className="users-modal-btn users-modal-btn-save"
                onClick={handleSaveEdit}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="users-modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="users-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Подтверждение удаления</h2>
            <p style={{ marginBottom: '1rem', color: '#555' }}>
              Вы уверены, что хотите удалить пользователя <strong>{showDeleteModal.email}</strong>?
              Это действие нельзя отменить.
            </p>
            <div className="users-modal-actions">
              <button
                className="users-modal-btn users-modal-btn-cancel"
                onClick={() => setShowDeleteModal(null)}
              >
                Отмена
              </button>
              <button
                className="users-modal-btn users-modal-btn-delete"
                onClick={handleConfirmDelete}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
