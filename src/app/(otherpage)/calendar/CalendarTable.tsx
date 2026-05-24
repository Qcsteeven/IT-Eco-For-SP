'use client';

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

interface CalendarTableOptions {
  year: number;
  month: number;
  events: Contest[];
}

function getEventTitle(event: Contest) {
  return event.title || event.name || 'Событие';
}

function getEventLink(event: Contest) {
  return event.registration_link || event.external_link || '#';
}

function getPlatformClass(event: Contest) {
  return (event.platform || 'custom')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
}

function getEventState(event: Contest, nowMs: number) {
  const startMs = new Date(event.start_time_utc).getTime();
  const endMs = new Date(event.end_time_utc).getTime();

  if (Number.isFinite(endMs) && nowMs > endMs) return 'done' as const;
  if (
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    nowMs >= startMs &&
    nowMs <= endMs
  ) {
    return 'live' as const;
  }

  return 'open' as const;
}

export default function CalendarTable({
  year,
  month,
  events,
}: CalendarTableOptions) {
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  const startDay = (firstDayOfMonth.getDay() + 6) % 7;
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const cells: {
    day: number;
    monthOffset: number;
    type: 'prev' | 'current' | 'next';
  }[] = [];

  for (let i = startDay - 1; i >= 0; i--) {
    cells.push({
      day: prevMonthLastDay - i,
      monthOffset: -1,
      type: 'prev',
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      day: i,
      monthOffset: 0,
      type: 'current',
    });
  }

  while (cells.length < 42) {
    cells.push({
      day: cells.length - (startDay + daysInMonth) + 1,
      monthOffset: 1,
      type: 'next',
    });
  }

  return (
    <table className="calendar-table">
      <tbody>
        <tr>
          {weekDays.map((day) => (
            <td className="calendar-table-td _head-line" key={day}>
              {day}
            </td>
          ))}
        </tr>
        {Array.from({ length: 6 }).map((_, row) => (
          <tr key={row}>
            {cells.slice(row * 7, row * 7 + 7).map((cell, index) => {
              const cellDate = new Date(
                year,
                month + cell.monthOffset,
                cell.day,
              );

              const dayEvents = events.filter((event) => {
                const eventDate = new Date(event.start_time_utc);
                return (
                  eventDate.getDate() === cell.day &&
                  eventDate.getMonth() === cellDate.getMonth() &&
                  eventDate.getFullYear() === cellDate.getFullYear()
                );
              });

              const nowMs = Date.now();
              const states = dayEvents.map((event) =>
                getEventState(event, nowMs),
              );
              const hasLive = states.includes('live');
              const hasOpen = states.includes('open');
              const cellState = hasLive
                ? 'live'
                : hasOpen
                  ? 'open'
                  : states.length
                    ? 'done'
                    : null;

              return (
                <td
                  key={`${row}-${index}`}
                  className={`calendar-table-td _${cell.type} ${
                    dayEvents.length ? '_has-events' : ''
                  }`}
                >
                  <div className="c-ttd-content">
                    <span className="c-day-number">{cell.day}</span>

                    <div className="c-day-events">
                      {cellState && (
                        <div
                          className={`c-day-state c-day-state--${cellState}`}
                        >
                          {cellState === 'done'
                            ? 'Завершено'
                            : cellState === 'live'
                              ? 'Идет сейчас'
                              : 'Регистрация открыта'}
                        </div>
                      )}
                      {dayEvents.map((event) => (
                        <a
                          key={event.id}
                          href={getEventLink(event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`c-event-item _${getPlatformClass(event)}`}
                          title={getEventTitle(event)}
                        >
                          <span className="c-event-item__name">
                            {getEventTitle(event)}
                          </span>
                          <span className="c-event-item__platform">
                            {event.platform}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="c-ttd-ratio" />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
