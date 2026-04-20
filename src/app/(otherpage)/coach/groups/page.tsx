'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import { useRouter } from 'next/navigation';
import '../coach.scss';

type Group = {
  id: string;
  name: string;
  description?: string;
  is_archived?: boolean;
};

export default function CoachGroupsPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('coach');
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => (g.name || '').toLowerCase().includes(q));
  }, [groups, search]);

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  useEffect(() => {
    if (authorized) fetchGroups();
  }, [authorized]);

  async function fetchGroups() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/groups');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Ошибка загрузки групп');
      setGroups(data.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки групп');
    } finally {
      setLoading(false);
    }
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Ошибка создания группы');
      setShowCreate(false);
      setCreateForm({ name: '', description: '' });
      await fetchGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка создания группы');
    }
  }

  async function archiveGroup(groupId: string) {
    if (!confirm('Архивировать группу?')) return;
    try {
      setError(null);
      const rawId = groupId.includes(':') ? groupId.split(':')[1] : groupId;
      const res = await fetch(`/api/groups/${rawId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Ошибка архивирования');
      await fetchGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка архивирования');
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
          <Link href="/coach" className="coach-back-link">
            ← Назад
          </Link>
          <div className="coach-header-content">
            <h1>Группы</h1>
            <button
              className="coach-btn coach-btn-primary"
              onClick={() => setShowCreate((s) => !s)}
            >
              {showCreate ? 'Отменить' : '+ Создать группу'}
            </button>
          </div>
        </div>

        {error && (
          <div className="coach-error-banner">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {showCreate && (
          <div className="coach-form-card">
            <h2>Новая группа</h2>
            <form onSubmit={createGroup} className="coach-form">
              <div className="coach-form-group">
                <label htmlFor="name">Название</label>
                <input
                  id="name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="coach-form-group">
                <label htmlFor="desc">Описание</label>
                <input
                  id="desc"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>
              <button type="submit" className="coach-btn coach-btn-primary">
                Создать
              </button>
            </form>
          </div>
        )}

        <div className="coach-section">
          <h2>Список</h2>
          <div style={{ marginBottom: '1rem' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию..."
              style={{
                width: '100%',
                maxWidth: 420,
                padding: '0.75rem',
                borderRadius: 8,
                border: '1px solid #ddd',
              }}
            />
          </div>

          {loading ? (
            <div className="coach-loading-inner">Загрузка групп...</div>
          ) : filtered.length === 0 ? (
            <div className="coach-empty">
              <p>Группы не найдены</p>
            </div>
          ) : (
            <div className="coach-contests-grid">
              {filtered.map((g) => {
                const rawId = g.id.includes(':') ? g.id.split(':')[1] : g.id;
                return (
                  <div key={g.id} className="coach-contest-card">
                    <div className="coach-contest-header">
                      <h3>{g.name}</h3>
                    </div>
                    {g.description && (
                      <div className="coach-contest-info">
                        <p>{g.description}</p>
                      </div>
                    )}
                    <div className="coach-contest-actions">
                      <Link className="coach-action-btn coach-btn-edit" href={`/coach/groups/${rawId}`}>
                        👥
                      </Link>
                      <Link
                        className="coach-action-btn coach-btn-edit"
                        href={`/coach/groups/${rawId}/analytics`}
                        title="Аналитика группы"
                      >
                        📊
                      </Link>
                      <button
                        className="coach-action-btn coach-btn-delete"
                        onClick={() => archiveGroup(g.id)}
                        title="Архивировать"
                      >
                        🗄️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

