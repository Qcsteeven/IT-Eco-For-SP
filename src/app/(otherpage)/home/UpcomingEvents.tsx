// UpcomingEvents.tsx
'use client'; // Необходимо, так как используется стейт и хуки

import React, { useState, useEffect } from 'react';
import Card, { CardProps } from './Card'; // Импортируем CardProps

import './upcoming-events.scss';

// Интерфейс для данных события
export interface EventData {
  id: string; // Id события
  title: string;
  platform: string;
  status: string;
  start_date: string;
  end_date: string;
  registration_link: string;
  // ... другие поля, соответствующие вашей БД
}

// Интерфейс для ответа API
interface ApiResponse {
  ok: boolean;
  data?: EventData[];
  error?: string;
}

export default function UpcomingEvents() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        // Предполагаем, что API находится по пути /api/events
        const response = await fetch('/api/events');
        const result: ApiResponse = await response.json();

        if (response.ok && result.ok && result.data) {
          // Для простоты, мы используем данные напрямую
          setEvents(result.data);
        } else {
          setError(result.error || 'Не удалось загрузить события.');
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError('Сетевая ошибка при загрузке событий.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="upcoming-events">
        <h1 className="ue-title">Ближайшие события</h1>
        <p>Загрузка событий...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="upcoming-events">
        <h1 className="ue-title">Ближайшие события</h1>
        <p style={{ color: 'red' }}>Ошибка загрузки: {error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="upcoming-events">
        <h1 className="ue-title">Ближайшие события</h1>
        <p>Нет запланированных событий.</p>
      </div>
    );
  }

  // Рендеринг карточек на основе загруженных данных
  const cards = events.map((event) => {
    // Приводим тип event к EventData для CardProps,
    // чтобы передать его в компонент Card
    const cardData: CardProps['event'] = {
      title: event.title,
      platform: event.platform,
      status: event.status,
      start_date: event.start_date,
      end_date: event.end_date,
      registration_link: event.registration_link,
    };

    return <Card key={event.id} event={cardData} />;
  });

  return (
    <div className="upcoming-events">
      <h1 className="ue-title">Ближайшие события</h1>
      <div className="ue-list">{cards}</div>
      <div className="ue-next-block">
        <button className="ue-next-btn">Показать еще</button>
      </div>
    </div>
  );
}
