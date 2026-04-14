'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  platform: string;
  status: string;
  start_time_utc: string;
  end_time_utc: string;
  external_link: string;
  visibility_type: 'public' | 'private';
  participant_list: string[];
  created_by?: string;
}

const PLATFORMS = [
  { value: 'codeforces', label: 'Codeforces' },
  { value: 'atcoder', label: 'AtCoder' },
  { value: 'custom', label: 'Своя ссылка' },
  { value: 'other', label: 'Другое' },
];

const STATUSES = [
  { value: 'upcoming', label: 'Предстоящий' },
  { value: 'active', label: 'Активный' },
  { value: 'completed', label: 'Завершён' },
  { value: 'cancelled', label: 'Отменён' },
];

function toISODate(local: string): string {
  if (!local) return '';
  if (local.endsWith('Z')) return local;
  return local + ':00.000Z';
}

export default function EventsManagementPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    platform: 'codeforces',
    status: 'upcoming',
    start_time_utc: '',
    end_time_utc: '',
    external_link: '',
    visibility_type: 'public' as 'public' | 'private',
    participant_list: [] as string[],
  });

  // Проверка доступа
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      const role = (session?.user as { role?: string })?.role;
      if (role === 'coach' || role === 'admin') {
        setHasAccess(true);
      } else {
        router.push('/dashboard');
      }
    } else if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [sessionStatus, session, router]);

  // Загрузка данных
  useEffect(() => {
    if (sessionStatus === 'authenticated' && hasAccess) {
      fetchData();
    }
  }, [sessionStatus, hasAccess]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [eventsRes, usersRes] = await Promise.all([
        axios.get('/api/events'),
        axios.get('/api/users?limit=200'),
      ]);
      setEvents(eventsRes.data.data || []);
      setUsers(usersRes.data.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      platform: 'codeforces',
      status: 'upcoming',
      start_time_utc: '',
      end_time_utc: '',
      external_link: '',
      visibility_type: 'public',
      participant_list: [],
    });
    setEditingEvent(null);
    setShowForm(false);
  };

  const openEditForm = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      platform: event.platform,
      status: event.status,
      start_time_utc: event.start_time_utc
        ? event.start_time_utc.slice(0, 16)
        : '',
      end_time_utc: event.end_time_utc ? event.end_time_utc.slice(0, 16) : '',
      external_link: event.external_link,
      visibility_type: event.visibility_type,
      participant_list: [...(event.participant_list || [])],
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        start_time_utc: toISODate(formData.start_time_utc),
        end_time_utc: toISODate(formData.end_time_utc),
      };
      if (editingEvent) {
        await axios.put(`/api/events/${editingEvent.id}`, payload);
      } else {
        await axios.post('/api/events', payload);
      }
      resetForm();
      fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Ошибка сохранения';
      alert(msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить мероприятие?')) return;
    try {
      await axios.delete(`/api/events/${id}`);
      fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Ошибка удаления';
      alert(msg);
    }
  };

  const toggleParticipant = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      participant_list: prev.participant_list.includes(userId)
        ? prev.participant_list.filter((id) => id !== userId)
        : [...prev.participant_list, userId],
    }));
  };

  const handleSync = async (eventId: string) => {
    try {
      const res = await axios.post(`/api/events/${eventId}/sync-results`);
      alert(res.data.message || 'Синхронизация завершена');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Ошибка синхронизации';
      alert(msg);
    }
  };

  if (sessionStatus === 'loading' || loading || !hasAccess) {
    return <div className="events-loading">Загрузка...</div>;
  }

  return (
    <div className="events-management">
      <div className="events-header">
        <h1>Управление мероприятиями</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Отмена' : '+ Создать мероприятие'}
        </button>
      </div>

      {showForm && (
        <form className="event-form" onSubmit={handleSubmit}>
          <h2>{editingEvent ? 'Редактирование' : 'Новое мероприятие'}</h2>

          <div className="form-group">
            <label>Название *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
              placeholder="Codeforces Round #900"
            />
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Описание мероприятия..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Платформа *</label>
              <select
                value={formData.platform}
                onChange={(e) =>
                  setFormData({ ...formData, platform: e.target.value })
                }
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Статус *</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Начало *</label>
              <input
                type="datetime-local"
                value={formData.start_time_utc}
                onChange={(e) =>
                  setFormData({ ...formData, start_time_utc: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label>Окончание *</label>
              <input
                type="datetime-local"
                value={formData.end_time_utc}
                onChange={(e) =>
                  setFormData({ ...formData, end_time_utc: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Внешняя ссылка *</label>
            <input
              type="url"
              value={formData.external_link}
              onChange={(e) =>
                setFormData({ ...formData, external_link: e.target.value })
              }
              required
              placeholder="https://codeforces.com/contest/1900"
            />
          </div>

          <div className="form-group">
            <label>Видимость *</label>
            <div className="visibility-options">
              <label
                className={`radio-option ${formData.visibility_type === 'public' ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={formData.visibility_type === 'public'}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      visibility_type: 'public',
                      participant_list: [],
                    })
                  }
                />
                <span>🌍 Публичное (для всех)</span>
              </label>
              <label
                className={`radio-option ${formData.visibility_type === 'private' ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={formData.visibility_type === 'private'}
                  onChange={() =>
                    setFormData({ ...formData, visibility_type: 'private' })
                  }
                />
                <span>🔒 Приватное (только для назначенных)</span>
              </label>
            </div>
          </div>

          {formData.visibility_type === 'private' && (
            <div className="form-group participants-selector">
              <label>Участники *</label>
              <p className="hint">
                Выберите пользователей, которым будет видно это мероприятие
              </p>
              <div className="participants-list">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className={`participant-item ${formData.participant_list.includes(user.id) ? 'selected' : ''}`}
                    onClick={() => toggleParticipant(user.id)}
                  >
                    <input
                      type="checkbox"
                      checked={formData.participant_list.includes(user.id)}
                      onChange={() => {}}
                    />
                    <span className="participant-name">
                      {user.full_name || user.email}
                    </span>
                    <span className="participant-email">{user.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingEvent ? 'Сохранить' : 'Создать'}
            </button>
            {editingEvent && (
              <button
                type="button"
                className="btn-secondary"
                onClick={resetForm}
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      )}

      <div className="events-list">
        <h2>Мероприятия ({events.length})</h2>
        {events.length === 0 ? (
          <p className="empty-state">Нет мероприятий. Создайте первое!</p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className={`event-card ${event.visibility_type}`}
            >
              <div className="event-card-header">
                <div className="event-info">
                  <h3>{event.title}</h3>
                  <div className="event-meta">
                    <span className={`badge platform ${event.platform}`}>
                      {event.platform}
                    </span>
                    <span className={`badge status ${event.status}`}>
                      {event.status}
                    </span>
                    <span
                      className={`badge visibility ${event.visibility_type}`}
                    >
                      {event.visibility_type === 'public'
                        ? '🌍 Public'
                        : '🔒 Private'}
                    </span>
                  </div>
                  {event.visibility_type === 'private' && (
                    <span className="participants-count">
                      Участников: {event.participant_list?.length || 0}
                    </span>
                  )}
                </div>
                <div className="event-actions">
                  {event.status === 'completed' &&
                    event.visibility_type === 'private' && (
                      <button
                        className="btn-sync"
                        onClick={() => handleSync(event.id)}
                        title="Синхронизировать результаты"
                      >
                        🔄 Синхронизировать
                      </button>
                    )}
                  <button
                    className="btn-edit"
                    onClick={() => openEditForm(event)}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(event.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="event-card-body">
                <div className="event-dates">
                  <span>
                    Начало:{' '}
                    {new Date(event.start_time_utc).toLocaleString('ru-RU')}
                  </span>
                  <span>
                    Окончание:{' '}
                    {new Date(event.end_time_utc).toLocaleString('ru-RU')}
                  </span>
                </div>
                {event.external_link && (
                  <a
                    href={event.external_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    🔗 Перейти к контесту
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .events-management {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        .events-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .events-header h1 {
          font-size: 1.8rem;
          color: #1a1a2e;
        }
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
        }
        .event-form {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        .event-form h2 {
          margin-bottom: 1.5rem;
          color: #1a1a2e;
        }
        .form-group {
          margin-bottom: 1.25rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #4a5568;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 1rem;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .visibility-options {
          display: flex;
          gap: 1rem;
        }
        .radio-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
        }
        .radio-option.active {
          border-color: #667eea;
          background: #f0f4ff;
        }
        .participants-selector .hint {
          font-size: 0.875rem;
          color: #718096;
          margin-bottom: 0.75rem;
        }
        .participants-list {
          max-height: 300px;
          overflow-y: auto;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          padding: 0.5rem;
        }
        .participant-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 6px;
          cursor: pointer;
        }
        .participant-item:hover {
          background: #f7fafc;
        }
        .participant-item.selected {
          background: #e6f0ff;
          border-left: 3px solid #667eea;
        }
        .participant-name {
          font-weight: 600;
          color: #1a1a2e;
        }
        .participant-email {
          font-size: 0.875rem;
          color: #718096;
          margin-left: auto;
        }
        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }
        .btn-secondary {
          background: #e2e8f0;
          color: #4a5568;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
        }
        .events-list h2 {
          margin-bottom: 1rem;
          color: #1a1a2e;
        }
        .event-card {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          border-left: 4px solid #667eea;
        }
        .event-card.private {
          border-left-color: #f59e0b;
        }
        .event-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        .event-info h3 {
          margin: 0 0 0.5rem 0;
          color: #1a1a2e;
        }
        .event-meta {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .badge {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .badge.platform {
          background: #e0e7ff;
          color: #4338ca;
        }
        .badge.status {
          background: #d1fae5;
          color: #065f46;
        }
        .badge.visibility {
          background: #fef3c7;
          color: #92400e;
        }
        .participants-count {
          font-size: 0.875rem;
          color: #718096;
          margin-top: 0.5rem;
        }
        .event-actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .btn-sync {
          background: #10b981;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          margin-right: 0.5rem;
        }
        .btn-edit,
        .btn-delete {
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0.25rem;
        }
        .btn-edit:hover,
        .btn-delete:hover {
          transform: scale(1.2);
        }
        .event-card-body {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .event-dates {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.875rem;
          color: #4a5568;
        }
        .external-link {
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .external-link:hover {
          text-decoration: underline;
        }
        .empty-state {
          text-align: center;
          color: #718096;
          padding: 3rem;
          font-size: 1.1rem;
        }
        .events-loading {
          text-align: center;
          padding: 4rem;
          color: #718096;
          font-size: 1.2rem;
        }
        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }
          .visibility-options {
            flex-direction: column;
          }
          .event-card-header {
            flex-direction: column;
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
