'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  getEventYearBounds,
  validateEventSchedule,
} from '@/lib/events/validation';
import { toGroupThingId, toUserThingId } from '@/lib/surreal/ids';
import './events.scss';

type EventVisibility = 'public' | 'private';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface ManagedEvent {
  id: string;
  title: string;
  description?: string;
  platform: string;
  status: string;
  start_time_utc: string;
  end_time_utc: string;
  external_link: string;
  registration_link?: string;
  visibility_type: EventVisibility;
  participant_list: string[];
  target_groups?: string[];
  created_by?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

type EventFormData = {
  title: string;
  description: string;
  platform: string;
  status: string;
  start_time_utc: string;
  end_time_utc: string;
  external_link: string;
  visibility_type: EventVisibility;
  participant_list: string[];
  target_groups: string[];
};

const EMPTY_FORM: EventFormData = {
  title: '',
  description: '',
  platform: 'custom',
  status: 'upcoming',
  start_time_utc: '',
  end_time_utc: '',
  external_link: '',
  visibility_type: 'public',
  participant_list: [],
  target_groups: [],
};

const PLATFORMS = [
  { value: 'codeforces', label: 'Codeforces' },
  { value: 'atcoder', label: 'AtCoder' },
  { value: 'custom', label: 'Своя ссылка' },
  { value: 'other', label: 'Другое' },
];

const STATUSES = [
  { value: 'upcoming', label: 'Предстоящий' },
  { value: 'active', label: 'Активный' },
  { value: 'completed', label: 'Завершен' },
  { value: 'cancelled', label: 'Отменен' },
];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Публичное' },
  { value: 'private', label: 'Приватное' },
] satisfies { value: EventVisibility; label: string }[];

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function recordId(value: unknown): string {
  if (value == null) return '';

  if (typeof value === 'string') {
    return safeDecode(value);
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.tb === 'string' && record.id != null) {
      return `${record.tb}:${String(record.id)}`;
    }

    if (record.id != null) return recordId(record.id);
  }

  return String(value);
}

function toIsoFromLocal(value: string): string {
  if (!value) return '';
  if (value.endsWith('Z')) return value;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toLocalInputValue(value: string): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(value: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function platformLabel(platform: string) {
  return PLATFORMS.find((item) => item.value === platform)?.label ?? platform;
}

function statusLabel(status: string) {
  return STATUSES.find((item) => item.value === status)?.label ?? status;
}

function normalizeEvent(event: ManagedEvent): ManagedEvent {
  return {
    ...event,
    id: recordId(event.id),
    external_link: event.external_link || event.registration_link || '',
    visibility_type: event.visibility_type === 'private' ? 'private' : 'public',
    participant_list: (event.participant_list || [])
      .map(recordId)
      .filter(Boolean),
    target_groups: (event.target_groups || []).map(recordId).filter(Boolean),
  };
}

async function readApi<T>(url: string, fallback: T): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не удалось загрузить данные');
  }

  return payload.data ?? fallback;
}

export default function EventsManagementPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ManagedEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>(EMPTY_FORM);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupMemberUserIds, setGroupMemberUserIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const hasAccess = userRole === 'coach' || userRole === 'admin';
  const dateInputLimits = useMemo(() => {
    const { minYear, maxYear } = getEventYearBounds();
    return {
      min: `${minYear}-01-01T00:00`,
      max: `${maxYear}-12-31T23:59`,
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && !hasAccess) {
      router.push('/dashboard');
    } else if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [hasAccess, router, sessionStatus]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventsData, usersData, groupsData] = await Promise.all([
        readApi<ManagedEvent[]>('/api/events?includeContests=false', []),
        readApi<User[]>('/api/users?limit=200', []),
        readApi<Group[]>('/api/groups', []),
      ]);

      setEvents(eventsData.map(normalizeEvent));
      setUsers(
        usersData.map((user) => ({
          ...user,
          id: toUserThingId(recordId(user.id)),
        })),
      );
      setGroups(
        groupsData.map((group) => ({
          ...group,
          id: toGroupThingId(recordId(group.id)),
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить данные',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && hasAccess) {
      fetchData();
    }
  }, [fetchData, hasAccess, sessionStatus]);

  function resetForm() {
    setFormData(EMPTY_FORM);
    setEditingEvent(null);
    setShowForm(false);
    setSubmitting(false);
    setGroupSearch('');
    setGroupMemberUserIds([]);
  }

  function openCreateForm() {
    setEditingEvent(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEditForm(event: ManagedEvent) {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      platform: event.platform,
      status: event.status,
      start_time_utc: toLocalInputValue(event.start_time_utc),
      end_time_utc: toLocalInputValue(event.end_time_utc),
      external_link: event.external_link || event.registration_link || '',
      visibility_type: event.visibility_type,
      participant_list: (event.participant_list || [])
        .map((id) => toUserThingId(recordId(id)))
        .filter(Boolean),
      target_groups: (event.target_groups || [])
        .map((id) => toGroupThingId(recordId(id)))
        .filter(Boolean),
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function updateForm<K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K],
  ) {
    setFormData((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const scheduleError = validateEventSchedule({
      status: formData.status,
      start: formData.start_time_utc,
      end: formData.end_time_utc,
    });
    if (scheduleError) {
      setError(scheduleError);
      return;
    }

    const startIso = toIsoFromLocal(formData.start_time_utc);
    const endIso = toIsoFromLocal(formData.end_time_utc);

    if (
      formData.visibility_type === 'private' &&
      formData.participant_list.length === 0 &&
      formData.target_groups.length === 0
    ) {
      setError('Для приватного мероприятия выберите группу или участников');
      return;
    }

    const payload = {
      ...formData,
      title: formData.title.trim(),
      description: formData.description.trim(),
      external_link: formData.external_link.trim(),
      start_time_utc: startIso,
      end_time_utc: endIso,
      participant_list:
        formData.visibility_type === 'private' ? formData.participant_list : [],
      target_groups:
        formData.visibility_type === 'private' ? formData.target_groups : [],
    };

    try {
      setSubmitting(true);
      const response = await fetch(
        editingEvent
          ? `/api/events/${encodeURIComponent(editingEvent.id)}`
          : '/api/events',
        {
          method: editingEvent ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as ApiResponse<ManagedEvent>;

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Ошибка сохранения мероприятия');
      }

      setSuccess(
        editingEvent ? 'Мероприятие обновлено' : 'Мероприятие создано',
      );
      resetForm();
      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ошибка сохранения мероприятия',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(eventId: string) {
    if (!window.confirm('Удалить мероприятие?')) return;

    try {
      setError(null);
      const response = await fetch(
        `/api/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
        },
      );
      const result = (await response.json()) as ApiResponse<null>;

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Ошибка удаления мероприятия');
      }

      setSuccess('Мероприятие удалено');
      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ошибка удаления мероприятия',
      );
    }
  }

  function toggleParticipant(userId: string) {
    setFormData((current) => ({
      ...current,
      participant_list: current.participant_list.includes(userId)
        ? current.participant_list.filter((id) => id !== userId)
        : [...current.participant_list, userId],
    }));
  }

  function toggleGroup(groupId: string) {
    const normalized = toGroupThingId(recordId(groupId));
    setFormData((current) => ({
      ...current,
      target_groups: current.target_groups.includes(normalized)
        ? current.target_groups.filter((id) => id !== normalized)
        : [...current.target_groups, normalized],
    }));
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchMembersForGroups(groupIds: string[]) {
      if (formData.visibility_type !== 'private' || groupIds.length === 0) {
        setGroupMemberUserIds([]);
        return;
      }

      try {
        const results = await Promise.all(
          groupIds.map(async (groupId) => {
            const response = await fetch(
              `/api/groups/${encodeURIComponent(groupId)}/members`,
              { cache: 'no-store' },
            );
            const json = (await response.json()) as ApiResponse<
              { user_id?: unknown }[]
            >;
            if (!json.ok || !Array.isArray(json.data)) return [];

            return json.data
              .map((member) => toUserThingId(recordId(member.user_id)))
              .filter(Boolean);
          }),
        );

        if (!cancelled) {
          setGroupMemberUserIds(Array.from(new Set(results.flat())));
        }
      } catch {
        if (!cancelled) setGroupMemberUserIds([]);
      }
    }

    fetchMembersForGroups(formData.target_groups);

    return () => {
      cancelled = true;
    };
  }, [formData.target_groups, formData.visibility_type]);

  useEffect(() => {
    if (
      formData.visibility_type !== 'private' ||
      groupMemberUserIds.length === 0
    ) {
      return;
    }

    const excluded = new Set(groupMemberUserIds);
    setFormData((current) => {
      const filtered = current.participant_list.filter(
        (id) => !excluded.has(id),
      );
      return filtered.length === current.participant_list.length
        ? current
        : { ...current, participant_list: filtered };
    });
  }, [formData.visibility_type, groupMemberUserIds]);

  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return groups;

    return groups.filter((group) => group.name.toLowerCase().includes(query));
  }, [groupSearch, groups]);

  const directParticipantsCount = useMemo(
    () => new Set(formData.participant_list).size,
    [formData.participant_list],
  );

  const directUsers = useMemo(
    () => users.filter((user) => !groupMemberUserIds.includes(user.id)),
    [groupMemberUserIds, users],
  );

  const visibleEvents = events.slice(0, visibleCount);
  const canEditEvent = (event: ManagedEvent) =>
    userRole === 'admin' || event.platform === 'custom';
  const canDeleteEvent = canEditEvent;

  if (sessionStatus === 'loading' || (loading && events.length === 0)) {
    return <div className="events-loading">Загрузка...</div>;
  }

  if (!hasAccess) {
    return <div className="events-loading">Проверка доступа...</div>;
  }

  return (
    <main
      className={`events-management ${
        showForm ? 'events-management--form-open' : ''
      }`}
    >
      <div className="events-container">
        <header className="events-header">
          <h1>Управление мероприятиями</h1>
          {!showForm && (
            <button
              type="button"
              className="events-create-btn"
              onClick={openCreateForm}
            >
              <Plus size={18} aria-hidden="true" />
              Создать мероприятие
            </button>
          )}
        </header>

        {error && (
          <div className="events-banner events-banner--error">
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
          <div className="events-banner events-banner--success">
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

        {showForm && (
          <form className="event-form" onSubmit={handleSubmit}>
            <h2>
              {editingEvent
                ? 'Редактировать мероприятие'
                : 'Создать мероприятие'}
            </h2>

            <div className="event-form__grid">
              <label className="event-field">
                <span>Название</span>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                  required
                  placeholder="Codeforces Round #945"
                />
              </label>

              <label className="event-field">
                <span>Начало</span>
                <input
                  type="datetime-local"
                  value={formData.start_time_utc}
                  min={dateInputLimits.min}
                  max={dateInputLimits.max}
                  onChange={(event) =>
                    updateForm('start_time_utc', event.target.value)
                  }
                  required
                />
              </label>

              <label className="event-field">
                <span>Описание</span>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(event) =>
                    updateForm('description', event.target.value)
                  }
                  placeholder="Описание мероприятия"
                />
              </label>

              <label className="event-field">
                <span>Окончание</span>
                <input
                  type="datetime-local"
                  value={formData.end_time_utc}
                  min={dateInputLimits.min}
                  max={dateInputLimits.max}
                  onChange={(event) =>
                    updateForm('end_time_utc', event.target.value)
                  }
                  required
                />
              </label>

              <label className="event-field">
                <span>Платформа</span>
                <select
                  value={formData.platform}
                  disabled={userRole === 'coach'}
                  onChange={(event) =>
                    updateForm('platform', event.target.value)
                  }
                  required
                >
                  {PLATFORMS.map((platform) => (
                    <option key={platform.value} value={platform.value}>
                      {platform.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="event-field">
                <span>Внешняя ссылка</span>
                <input
                  type="url"
                  value={formData.external_link}
                  onChange={(event) =>
                    updateForm('external_link', event.target.value)
                  }
                  required
                  placeholder="https://example.com"
                />
              </label>

              <label className="event-field">
                <span>Статус</span>
                <select
                  value={formData.status}
                  onChange={(event) => updateForm('status', event.target.value)}
                  required
                >
                  {STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="event-field">
                <span>Видимость</span>
                <select
                  value={formData.visibility_type}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      visibility_type: event.target.value as EventVisibility,
                      participant_list:
                        event.target.value === 'public'
                          ? []
                          : current.participant_list,
                      target_groups:
                        event.target.value === 'public'
                          ? []
                          : current.target_groups,
                    }))
                  }
                  required
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {formData.visibility_type === 'private' && (
              <section className="event-private-panel">
                <div>
                  <h3>Назначение приватного мероприятия</h3>
                  <p>
                    Выберите группы или отдельных пользователей. Участники
                    выбранных групп исключаются из ручного списка, чтобы не было
                    дублей.
                  </p>
                </div>

                <div className="event-private-grid">
                  <div className="event-picker">
                    <label>
                      <span>Группы</span>
                      <input
                        type="search"
                        value={groupSearch}
                        onChange={(event) => setGroupSearch(event.target.value)}
                        placeholder="Поиск группы"
                      />
                    </label>
                    <div className="event-picker__list">
                      {filteredGroups.map((group) => (
                        <button
                          type="button"
                          key={group.id}
                          className={
                            formData.target_groups.includes(group.id)
                              ? 'is-selected'
                              : ''
                          }
                          onClick={() => toggleGroup(group.id)}
                        >
                          <span>{group.name}</span>
                          <small>{group.id}</small>
                        </button>
                      ))}
                      {filteredGroups.length === 0 && <p>Группы не найдены</p>}
                    </div>
                  </div>

                  <div className="event-picker">
                    <span className="event-picker__title">Пользователи</span>
                    <div className="event-picker__list">
                      {directUsers.map((user) => (
                        <button
                          type="button"
                          key={user.id}
                          className={
                            formData.participant_list.includes(user.id)
                              ? 'is-selected'
                              : ''
                          }
                          onClick={() => toggleParticipant(user.id)}
                        >
                          <span>{user.full_name || user.email}</span>
                          <small>{user.email}</small>
                        </button>
                      ))}
                      {directUsers.length === 0 && (
                        <p>Пользователи не найдены</p>
                      )}
                    </div>
                  </div>
                </div>

                <p className="event-private-panel__summary">
                  Выбрано пользователей: {directParticipantsCount}. Выбрано
                  групп: {formData.target_groups.length}.
                </p>
              </section>
            )}

            <div className="event-form__actions">
              <button
                type="button"
                className="event-form-btn event-form-btn--cancel"
                onClick={resetForm}
              >
                Отменить
              </button>
              <button
                type="submit"
                className="event-form-btn event-form-btn--save"
                disabled={submitting}
              >
                {submitting ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        )}

        <section className="events-grid" aria-label="Список мероприятий">
          {visibleEvents.map((event) => (
            <article key={event.id} className="event-card">
              <div className="event-card__top">
                <h2>{event.title}</h2>
                <div className="event-card__tags">
                  <span
                    className={`event-tag event-tag--${event.visibility_type}`}
                  >
                    {event.visibility_type}
                  </span>
                  <span
                    className={`event-tag event-tag--status-${event.status}`}
                  >
                    {statusLabel(event.status).toLowerCase()}
                  </span>
                </div>
              </div>

              <div className="event-card__platform">
                <span className="event-card__bell">
                  <Bell size={30} aria-hidden="true" />
                </span>
                <strong>[{platformLabel(event.platform)}]</strong>
              </div>

              <div className="event-card__dates">
                <p>
                  <span>Начало:</span>
                  {formatDateTime(event.start_time_utc)}
                </p>
                <p>
                  <span>Окончание:</span>
                  {formatDate(event.end_time_utc)}
                </p>
              </div>

              {event.visibility_type === 'private' && (
                <p className="event-card__participants">
                  Пользователей: {event.participant_list.length}. Групп:{' '}
                  {event.target_groups?.length || 0}.
                </p>
              )}

              <div className="event-card__actions">
                {event.external_link && (
                  <a
                    href={event.external_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-icon-btn event-icon-btn--link"
                    aria-label="Открыть внешнюю ссылку"
                    title="Открыть внешнюю ссылку"
                  >
                    <ExternalLink size={22} aria-hidden="true" />
                  </a>
                )}
                <button
                  type="button"
                  className="event-icon-btn event-icon-btn--edit"
                  disabled={!canEditEvent(event)}
                  onClick={() => {
                    if (canEditEvent(event)) openEditForm(event);
                  }}
                  aria-label={`Редактировать ${event.title}`}
                  title={
                    canEditEvent(event)
                      ? 'Редактировать'
                      : 'Тренер может редактировать только мероприятия со своей ссылкой'
                  }
                >
                  <Pencil size={28} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="event-icon-btn event-icon-btn--delete"
                  disabled={!canDeleteEvent(event)}
                  onClick={() => {
                    if (canDeleteEvent(event)) handleDelete(event.id);
                  }}
                  aria-label={`Удалить ${event.title}`}
                  title={
                    canDeleteEvent(event)
                      ? 'Удалить'
                      : 'Тренер может удалять только мероприятия со своей ссылкой'
                  }
                >
                  <Trash2 size={28} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}

          {!loading && events.length === 0 && (
            <div className="events-empty">
              <p>Мероприятия не найдены. Создайте первое мероприятие.</p>
            </div>
          )}
        </section>

        {events.length > visibleCount && (
          <div className="events-more">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + 4)}
            >
              Показать еще
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
