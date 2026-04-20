'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import { useParams, useRouter } from 'next/navigation';
import '../../coach.scss';

type Group = {
  id: string;
  name: string;
  description?: string;
};

type Member = {
  user_id: string;
  full_name?: string;
  email?: string;
  joined_at?: string;
};

type User = {
  id: string;
  full_name?: string;
  email: string;
};

export default function CoachGroupDetailsPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('coach');
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const groupId = typeof params?.id === 'string' ? params.id : '';

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  useEffect(() => {
    if (authorized && groupId) fetchAll();
  }, [authorized, groupId]);

  async function fetchAll() {
    try {
      setLoading(true);
      setError(null);

      const [gRes, mRes, uRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`),
        fetch(`/api/groups/${groupId}/members`),
        fetch('/api/users?limit=200'),
      ]);

      const g = await gRes.json();
      const m = await mRes.json();
      const u = await uRes.json();

      if (!g.ok) throw new Error(g.error || 'Ошибка загрузки группы');
      if (!m.ok) throw new Error(m.error || 'Ошибка загрузки участников');
      if (!u.ok) throw new Error(u.error || 'Ошибка загрузки пользователей');

      setGroup(g.data);
      setMembers(m.data || []);
      setUsers(u.data || []);
      setSelected({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const memberIdSet = new Set(members.map((m) => String(m.user_id)));
    const pool = users.filter((u) => !memberIdSet.has(String(u.id)));
    if (!q) return pool;
    return pool.filter((u) => {
      const name = (u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, members, search]);

  async function addSelected() {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) return;
    try {
      setError(null);
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: ids }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Ошибка добавления');
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка добавления');
    }
  }

  async function removeMember(userId: string) {
    if (!confirm('Удалить участника из группы?')) return;
    try {
      setError(null);
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Ошибка удаления');
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
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
          <Link href="/coach/groups" className="coach-back-link">
            ← Назад
          </Link>
          <div className="coach-header-content">
            <h1>{group?.name || 'Группа'}</h1>
            {groupId && (
              <Link className="coach-btn coach-btn-primary" href={`/coach/groups/${groupId}/analytics`}>
                Аналитика
              </Link>
            )}
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
        ) : (
          <>
            <div className="coach-section">
              <h2>Состав группы ({members.length})</h2>
              {members.length === 0 ? (
                <div className="coach-empty">
                  <p>Пока нет участников</p>
                </div>
              ) : (
                <div style={{ background: '#f8f9fa', borderRadius: 8 }}>
                  <table className="coach-table">
                    <thead>
                      <tr>
                        <th>Имя</th>
                        <th>Email</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={String(m.user_id)}>
                          <td>{m.full_name || '—'}</td>
                          <td>{m.email || '—'}</td>
                          <td style={{ width: 80 }}>
                            <button
                              className="coach-action-btn coach-btn-delete"
                              onClick={() => removeMember(String(m.user_id))}
                              title="Удалить"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="coach-section">
              <h2>Добавить участников</h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени/email..."
                  style={{
                    flex: '1 1 280px',
                    padding: '0.75rem',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                  }}
                />
                <button className="coach-btn coach-btn-primary" onClick={addSelected}>
                  Добавить выбранных
                </button>
              </div>

              <div style={{ marginTop: '1rem', maxHeight: 360, overflow: 'auto' }}>
                <table className="coach-table" style={{ background: 'white', borderRadius: 8 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Имя</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selected[u.id]}
                            onChange={(e) => setSelected((p) => ({ ...p, [u.id]: e.target.checked }))}
                          />
                        </td>
                        <td>{u.full_name || '—'}</td>
                        <td>{u.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

