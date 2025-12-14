interface CalendarTableOptions {
  year: number
  month: number
}


export default function CalendarTable({ year, month }: CalendarTableOptions) {
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()

  const startDay =
    (firstDayOfMonth.getDay() + 6) % 7

  const prevMonthLastDay = new Date(year, month, 0).getDate()

  const cells: { day: number, type: 'prev' | 'current' | 'next' }[] = []

  // дни предыдущего месяца
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push({
      day: prevMonthLastDay - i,
      type: 'prev',
    })
  }

  // дни текущего месяца
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      day: i,
      type: 'current',
    })
  }

  // дни следующего месяца (добиваем до 42 ячеек)
  while (cells.length < 42) {
    cells.push({
      day: cells.length - (startDay + daysInMonth) + 1,
      type: 'next',
    })
  }

  return (
    <table className="calendar-table">
      <tbody>
        <tr>
          {weekDays.map((d, i) => (
            <td className="calendar-table-td _head-line" key={i}>{d}</td>
          ))}
        </tr>
        {Array.from({ length: 6 }).map((_, row) => (
          <tr key={row}>
            {cells.slice(row * 7, row * 7 + 7).map((cell, i) => (
              <td
                key={i}
                className={`calendar-table-td _${cell.type}`}
              >
                <div className="c-ttd-content">
                  {cell.day}
                </div>
                <div className="c-ttd-ratio"></div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
