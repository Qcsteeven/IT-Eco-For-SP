'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import './calendar.scss';
import CalendarTable from './CalendarTable';

// Типизация для мероприятия (согласно полям в твоей базе SurrealDB)
interface Contest {
  id: string;
  name: string;
  platform: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link?: string;
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

  // Загружаем мероприятия при монтировании компонента
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        // Вызываем созданный нами ранее эндпоинт
        const response = await axios.get('/api/contests/all');
        setEvents(response.data);
      } catch (error) {
        console.error('Ошибка при загрузке мероприятий:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const changeMonth = (direction: number) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const formatted = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(currentDate);

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
          {loading && <span className="calendar-page__loading">...</span>}
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

      <div className="calendar-page__table">
        <CalendarTable
          year={currentDate.getFullYear()}
          month={currentDate.getMonth()}
          events={events}
        />
      </div>
    </div>
  );
}
