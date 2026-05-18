import Image from 'next/image';
import Link from 'next/link';

import './home-hero.scss';

const BANNER_SRC = '/home-assets/hero/banner-subtract.png';

export default function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero__inner">
        <div className="home-hero__banner">
          <Image
            className="home-hero__banner-img"
            src={BANNER_SRC}
            alt="Участники соревнований по программированию за компьютерами"
            fill
            sizes="(max-width: 768px) 100vw, 1328px"
            priority
          />
          <div className="home-hero__overlay">
            <h1 id="home-hero-title" className="home-hero__title">
              Что такое спортивное программирование?
            </h1>
            <p className="home-hero__lead">
              Киберспорт для ума: решай алгоритмические задачи на скорость,
              соревнуйся с сильными участниками и прокачивай инженерное
              мышление.
            </p>
            <Link href="/auth/signup" className="home-hero__cta">
              Стать участником
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
