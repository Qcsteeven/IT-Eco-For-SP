import HomeHero from './HomeHero';
import HomeWhySection from './HomeWhySection';
import HomeFeaturesSection from './HomeFeaturesSection';
import HomeContestsCarousel from './HomeContestsCarousel';
import HomePartnersCarousel from './HomePartnersCarousel';

export default function Home() {
  return (
    <div>
      <div className="main-section">
        <HomeHero />
        <HomeWhySection />
        <HomeFeaturesSection />
      </div>
      <HomeContestsCarousel />
      <HomePartnersCarousel />
    </div>
  )
}
