'use client';

interface Contest {
  id: string;
  name: string;
  platform: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link?: string;
}

interface CalendarTableOptions {
  year: number;
  month: number;
  events: Contest[]; // Добавили список событий
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

  // Дни предыдущего месяца
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push({
      day: prevMonthLastDay - i,
      monthOffset: -1,
      type: 'prev',
    });
  }

  // Дни текущего месяца
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      day: i,
      monthOffset: 0,
      type: 'current',
    });
  }

  // Дни следующего месяца
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
          {weekDays.map((d, i) => (
            <td className="calendar-table-td _head-line" key={i}>
              {d}
            </td>
          ))}
        </tr>
        {Array.from({ length: 6 }).map((_, row) => (
          <tr key={row}>
            {cells.slice(row * 7, row * 7 + 7).map((cell, i) => {
              // Логика поиска событий для конкретной ячейки
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

              return (
                <td key={i} className={`calendar-table-td _${cell.type}`}>
                  <div className="c-ttd-content">
                    <span className="c-day-number">{cell.day}</span>

                    {/* Список событий в ячейке */}
                    <div className="c-day-events">
                      {dayEvents.map((event) => (
                        <a
                          key={event.id}
                          href={event.registration_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`c-event-item _${event.platform.toLowerCase()}`}
                          title={event.name}
                        >
                          {event.name}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="c-ttd-ratio"></div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
