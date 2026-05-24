'use client';

import { useEffect, useMemo, useState } from 'react';
import './calendar.scss';
import CalendarTable from './CalendarTable';

interface Contest {
  id: string;
  name: string;
  title?: string;
  platform: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link?: string;
  external_link?: string;
}

function getMonthRange(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  return {
    from: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString(),
    to: new Date(Date.UTC(year, month + 2, 0, 23, 59, 59)).toISOString(),
  };
}

function getEventTitle(event: Contest) {
  return event.title || event.name || 'Событие';
}

function getEventLink(event: Contest) {
  return event.registration_link || event.external_link || '#';
}

function formatMobileEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function Calendar() {
  const arrowSvg = (
    <svg
      className="bcm-arrow"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 39 35"
      fill="none"
    >
      <path
        d="M20.3846 31.9093L17.5308 34.7366L0 17.3683L17.5308 0L20.3846 2.8274L7.74615 15.3488H38.3231V19.3879H7.74615L20.3846 31.9093Z"
        fill="currentColor"
      />
    </svg>
  );

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => getMonthRange(currentDate), [currentDate]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchEvents() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams(range);
        params.set('includeCodeforces', 'false');
        const response = await fetch(`/api/contests/all?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Сервер вернул ${response.status}`);
        }

        const data = (await response.json()) as Contest[];
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof Error ? err.message : 'Не удалось загрузить события';
        setError(message);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();

    return () => controller.abort();
  }, [range]);

  const changeMonth = (direction: number) => {
    setCurrentDate((prev) => {
      const nextDate = new Date(prev);
      nextDate.setMonth(prev.getMonth() + direction);
      return nextDate;
    });
  };

  const formatted = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(currentDate);

  const monthEvents = useMemo(() => {
    return events
      .filter((event) => {
        const date = new Date(event.start_time_utc);
        return (
          !Number.isNaN(date.getTime()) &&
          date.getMonth() === currentDate.getMonth() &&
          date.getFullYear() === currentDate.getFullYear()
        );
      })
      .sort(
        (a, b) =>
          new Date(a.start_time_utc).getTime() -
          new Date(b.start_time_utc).getTime(),
      );
  }, [currentDate, events]);

  return (
    <div className="calendar-page">
      <h1 className="calendar-page__title">Календарь ближайших событий</h1>

      <div className="calendar-page__month-row">
        <button
          type="button"
          className="calendar-page__month-btn calendar-page__month-btn--prev"
          onClick={() => changeMonth(-1)}
          aria-label="Предыдущий месяц"
        >
          {arrowSvg}
        </button>

        <div className="calendar-page__month">
          <span className="calendar-page__month-text">{formatted}</span>
          {loading && <span className="calendar-page__loading">загрузка</span>}
        </div>

        <button
          type="button"
          className="calendar-page__month-btn calendar-page__month-btn--next"
          onClick={() => changeMonth(1)}
          aria-label="Следующий месяц"
        >
          {arrowSvg}
        </button>
      </div>

      {error && (
        <div className="calendar-page__error">
          Не удалось загрузить события: {error}
        </div>
      )}

      <div className="calendar-page__table">
        <CalendarTable
          year={currentDate.getFullYear()}
          month={currentDate.getMonth()}
          events={events}
        />
      </div>

      <section className="calendar-page__mobile-events" aria-label="События месяца">
        <h2>События месяца</h2>
        {monthEvents.length === 0 ? (
          <p className="calendar-page__mobile-empty">На этот месяц событий нет.</p>
        ) : (
          <div className="calendar-mobile-list">
            {monthEvents.slice(0, 8).map((event) => (
              <a
                key={event.id}
                href={getEventLink(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="calendar-mobile-event"
              >
                <span>{formatMobileEventDate(event.start_time_utc)}</span>
                <strong>{getEventTitle(event)}</strong>
                <small>{event.platform}</small>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
