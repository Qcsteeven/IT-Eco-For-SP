export default function CalendarTable() {
  const headline = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    .map((el, index) => <td key={index} className="calendar-table-td _head-line">{el}</td>)

  const line = new Array(5).fill(0).map((el, il) => {
    const column = new Array(7).fill(0)
    return <tr key={il}>{
      column.map((el, ic) => {
        const currentDay = il * 7 + ic + 1
        return <td key={ic}>{currentDay}</td>
      })
    }</tr>
  })

  return (
    <table className="calendar-table">
      <tbody>
        <tr>
          {headline}
        </tr>
        {line}
      </tbody>
    </table>
  )
}