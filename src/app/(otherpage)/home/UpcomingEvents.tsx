import "./upcoming-events.scss";
import Card from "./Card";


export default function UpcomingEvents() {
  const cards = (new Array(6)).fill(0).map((el, index) => {
    return (<Card key={index}/>)
  })
  return (
    <div className="upcoming-events">
      <h1 className="ue-title">Ближайшие события</h1>
      <div className="ue-list">
        {cards}
      </div>
      <div className="ue-next-block">
        <button className="ue-next-btn">Показать еще</button>
      </div>
    </div>
  )
}
