import HomeHero from './HomeHero';
import HomeWhySection from './HomeWhySection';
import UpcomingEvents from './UpcomingEvents';

export default function Home() {
  return (
    <div>
      <div className="main-section">
        <HomeHero />
        <HomeWhySection />
      </div>
      <div className="upcoming-events">
        <UpcomingEvents />
      </div>
    </div>
  )
}
