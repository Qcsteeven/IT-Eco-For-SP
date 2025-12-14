// Card.tsx
import './card.scss';

// 1. Интерфейс для пропсов компонента Card
export interface CardProps {
  event: {
    title: string;
    platform: string;
    status: string;
    start_date: string;
    end_date: string;
    registration_link: string;
  };
}

// Вспомогательная функция для форматирования даты (если нужно)
const formatDate = (dateString: string) => {
  // Простая реализация форматирования для примера:
  const date = new Date(dateString);
  // Пример: 7 декабря 2025, 02:30 UTC
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset',
  });
};

// 2. Деструктурируем пропсы
export default function Card({ event }: CardProps) {
  return (
    <div className="contest-card">
      <div className="contest-header">
        <div className="contest-title">{event.title}</div>
        <div className="contest-platform">{event.platform}</div>
      </div>
      {/* Класс статуса может зависеть от значения event.status для стилизации */}
      <div className="contest-status">{event.status}</div>
      <div className="contest-body">
        <div className="contest-dates">
          <div className="contest-date">
            Дата начала: {formatDate(event.start_date)}
          </div>
          <div className="contest-date">
            Дата окончания: {formatDate(event.end_date)}
          </div>
        </div>
        <a
          href={event.registration_link}
          target="_blank"
          className="btn-register"
        >
          Регистрация →
        </a>
      </div>
    </div>
  );
}
