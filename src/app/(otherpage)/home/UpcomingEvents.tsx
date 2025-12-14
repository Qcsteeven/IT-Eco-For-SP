'use client';

import React, { useState, useEffect } from 'react';
import Card, { CardProps } from './Card';

import './upcoming-events.scss';

export interface EventData {
  id: string;
  title: string;
  platform: string;
  status: string;

  start_time_utc: string;
  end_time_utc: string;
  registration_link: string;

  platform_contest_id?: string;
}

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
        const response = await fetch('/api/events');
        const result: ApiResponse = await response.json();

        if (response.ok && result.ok && result.data) {
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

  const cards = events.map((event) => {
    const cardData: CardProps['event'] = {
      title: event.title,
      platform: event.platform,
      status: event.status,

      start_date: event.start_time_utc,
      end_date: event.end_time_utc,
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
