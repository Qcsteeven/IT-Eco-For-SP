import './card.scss';

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

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'Скоро',
  active: 'Идет сейчас',
  completed: 'Завершено',
  cancelled: 'Отменено',
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset',
  });
};

export default function Card({ event }: CardProps) {
  return (
    <div className="contest-card">
      <div className="contest-header">
        <div className="contest-title">{event.title}</div>
        <div className="contest-platform">{event.platform}</div>
      </div>
      <div className="contest-status">
        {STATUS_LABELS[event.status] || event.status}
      </div>
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
          rel="noreferrer"
          className="btn-register"
        >
          Регистрация
        </a>
      </div>
    </div>
  );
}
