import IntroBlock from "./IntroBlock"
import UpcomingEvents from './UpcomingEvents'


export default function Home() {
  return (
    <div>
      <div className="main-section">
        <IntroBlock />
      </div>
      <div className="upcoming-events">
        <UpcomingEvents />
      </div>
    </div>
  )
}
