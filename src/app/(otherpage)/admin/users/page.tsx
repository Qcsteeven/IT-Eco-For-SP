'use client';

import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  getRoleDisplayName,
  ROLE_PERMISSIONS,
  UserRole,
} from '@/lib/rbac';
import type { RolePermissions } from '@/lib/rbac';
import './users.scss';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_verified: boolean;
  is_blocked?: boolean;
  bscp_rating?: number;
  codeforces_karma?: number;
  registration_date: string;
}

type UserForm = {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: UserRole;
  is_verified: boolean;
  is_blocked: boolean;
};

const emptyCreateForm: UserForm = {
  email: '',
  password: '',
  full_name: '',
  phone: '',
  role: 'user',
  is_verified: true,
  is_blocked: false,
};

const permissionLabels: Record<keyof RolePermissions, string> = {
  canViewLanding: 'Лендинг и маркетинг',
  canViewGlobalRating: 'Глобальный рейтинг',
  canViewUpcomingContests: 'Календарь соревнований',
  canUseAIAssistant: 'AI-ассистент',
  canParticipateInContests: 'Участие в контестах',
  canViewPersonalDashboard: 'Личный dashboard',
  canManageContests: 'Управление контестами',
  canViewAnalytics: 'Аналитика групп',
  canManageUsers: 'Управление аккаунтами',
  canAdjustKarma: 'Корректировка кармы',
};

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editForm, setEditForm] = useState<UserForm>(emptyCreateForm);
  const [createForm, setCreateForm] = useState<UserForm>(emptyCreateForm);

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
    setEditForm({
      email: user.email || '',
      password: '',
      full_name: user.full_name || '',
      phone: user.phone || '',
      role: (user.role || 'user') as UserRole,
      is_verified: !!user.is_verified,
      is_blocked: !!user.is_blocked,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      setError(null);
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: editForm.email,
          full_name: editForm.full_name,
          phone: editForm.phone,
          role: editForm.role,
          is_verified: editForm.is_verified,
          is_blocked: editForm.is_blocked,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess('Пользователь успешно обновлён');
        setEditingUser(null);
        await fetchUsers();
      } else {
        setError(data.error || 'Ошибка обновления пользователя');
      }
    } catch (err) {
      setError('Не удалось обновить пользователя');
      console.error(err);
    }
  };

  const handleCreateUser = async () => {
    try {
      setError(null);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();

      if (data.ok) {
        setSuccess('Пользователь успешно создан');
        setShowCreateModal(false);
        setCreateForm(emptyCreateForm);
        await fetchUsers();
      } else {
        setError(data.error || 'Ошибка создания пользователя');
      }
    } catch (err) {
      setError('Не удалось создать пользователя');
      console.error(err);
    }
  };

  const handleDeleteClick = (user: User) => {
    setShowDeleteModal(user);
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteModal) return;

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
          <div className="users-header-row">
            <h1>Управление пользователями</h1>
            <button
              className="users-primary-btn"
              onClick={() => setShowCreateModal(true)}
            >
              Создать пользователя
            </button>
          </div>
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
                  <th>Статус</th>
                  <th>Рейтинг</th>
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
                        {getRoleDisplayName((user.role || 'user') as UserRole)}
                      </span>
                    </td>
                    <td>
                      <span className={`user-verified ${user.is_verified ? 'verified' : 'not-verified'}`}>
                        {user.is_verified ? '✓ Да' : '✗ Нет'}
                      </span>
                    </td>
                    <td>
                      <span className={`user-status ${user.is_blocked ? 'blocked' : 'active'}`}>
                        {user.is_blocked ? 'Заблокирован' : 'Активен'}
                      </span>
                    </td>
                    <td>
                      <span>{user.bscp_rating ?? 0}</span>
                      <span className="users-muted"> / {user.codeforces_karma ?? 0}</span>
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="users-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="users-modal users-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>Создать пользователя</h2>
            <div className="users-modal-form users-modal-grid">
              <div className="users-modal-group">
                <label>Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>
              <div className="users-modal-group">
                <label>Пароль</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
              </div>
              <div className="users-modal-group">
                <label>Имя</label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                />
              </div>
              <div className="users-modal-group">
                <label>Телефон</label>
                <input
                  type="text"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                />
              </div>
              <RoleSelect
                value={createForm.role}
                onChange={(role) => setCreateForm({ ...createForm, role })}
              />
              <StatusControls
                verified={createForm.is_verified}
                blocked={createForm.is_blocked}
                onVerifiedChange={(is_verified) => setCreateForm({ ...createForm, is_verified })}
                onBlockedChange={(is_blocked) => setCreateForm({ ...createForm, is_blocked })}
              />
            </div>
            <PermissionPreview role={createForm.role} />
            <div className="users-modal-actions">
              <button
                className="users-modal-btn users-modal-btn-cancel"
                onClick={() => setShowCreateModal(false)}
              >
                Отмена
              </button>
              <button
                className="users-modal-btn users-modal-btn-save"
                onClick={handleCreateUser}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="users-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="users-modal users-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>Редактировать пользователя</h2>
            <div className="users-modal-form users-modal-grid">
              <div className="users-modal-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="users-modal-group">
                <label>Имя</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>
              <div className="users-modal-group">
                <label>Телефон</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <RoleSelect
                value={editForm.role}
                onChange={(role) => setEditForm({ ...editForm, role })}
              />
              <StatusControls
                verified={editForm.is_verified}
                blocked={editForm.is_blocked}
                onVerifiedChange={(is_verified) => setEditForm({ ...editForm, is_verified })}
                onBlockedChange={(is_blocked) => setEditForm({ ...editForm, is_blocked })}
              />
            </div>
            <PermissionPreview role={editForm.role} />
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

function RoleSelect({
  value,
  onChange,
}: {
  value: UserRole;
  onChange: (role: UserRole) => void;
}) {
  return (
    <div className="users-modal-group">
      <label>Роль</label>
      <select value={value} onChange={(e) => onChange(e.target.value as UserRole)}>
        <option value="guest">Гость</option>
        <option value="user">Участник</option>
        <option value="coach">Тренер</option>
        <option value="admin">Администратор</option>
      </select>
    </div>
  );
}

function StatusControls({
  verified,
  blocked,
  onVerifiedChange,
  onBlockedChange,
}: {
  verified: boolean;
  blocked: boolean;
  onVerifiedChange: (value: boolean) => void;
  onBlockedChange: (value: boolean) => void;
}) {
  return (
    <div className="users-modal-group users-checkbox-group">
      <label>
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => onVerifiedChange(e.target.checked)}
        />
        Email подтверждён
      </label>
      <label>
        <input
          type="checkbox"
          checked={blocked}
          onChange={(e) => onBlockedChange(e.target.checked)}
        />
        Аккаунт заблокирован
      </label>
    </div>
  );
}

function PermissionPreview({ role }: { role: UserRole }) {
  const permissions = ROLE_PERMISSIONS[role];

  return (
    <div className="users-permissions">
      <h3>Права роли: {getRoleDisplayName(role)}</h3>
      <div className="users-permissions-grid">
        {(Object.entries(permissions) as [keyof RolePermissions, boolean][]).map(
          ([permission, enabled]) => (
            <div
              key={permission}
              className={`users-permission-item ${enabled ? 'enabled' : 'disabled'}`}
            >
              <span>{enabled ? '✓' : '—'}</span>
              {permissionLabels[permission]}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
