'use client'
import { useState } from 'react'
import './calendar.scss'
import CalendarTable from './CalendarTable'


export default function Calendar() {
  const arrowSvg = (
    <svg
      className="bcm-arrow"
      xmlns="http://www.w3.org/2000/svg"
      width="39"
      height="35"
      viewBox="0 0 39 35"
      fill="none"
    >
      <path
        d="M20.3846 31.9093L17.5308 34.7366L0 17.3683L17.5308 0L20.3846 2.8274L7.74615 15.3488H38.3231V19.3879H7.74615L20.3846 31.9093Z"
        fill="currentColor"
      />
    </svg>
  )

  // текущий месяц по умолчанию
  const [currentDate, setCurrentDate] = useState(new Date())

  const changeMonth = (direction: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  const formatted = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(currentDate)

  return (
    <div className="calendar">

      <div className="c-main">
        <button
          className="btn-change-month _prev"
          onClick={() => changeMonth(-1)}
        >
          {arrowSvg}
        </button>

        <div className="calendar-content">
          <div className="c-current-month">
            {formatted}
          </div>
          <CalendarTable
            year={currentDate.getFullYear()}
            month={currentDate.getMonth()}
          />
        </div>

        <button
          className="btn-change-month _next"
          onClick={() => changeMonth(1)}
        >
          {arrowSvg}
        </button>
      </div>
    </div>
  )
}
