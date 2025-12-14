import "./card.scss";


export default function Card() {
  return (
    <div className="contest-card">
      <div className="contest-header">
        <div className="contest-title">Weekly Contest 479</div>
        <div className="contest-platform">LeetCode</div>
      </div>
      <div className="contest-status">Регистрация открыта</div>
      <div className="contest-body">
        <div className="contest-dates">
          <div className="contest-date">Дата начала: 7 декабря 2025, 02:30 UTC</div>
          <div className="contest-date">Дата окончания: 7 декабря 2025, 02:30 UTC</div>
        </div>
        <a href="" target="_blank" className="btn-register">Регистрация →</a>
      </div>
    </div>
  )
}

