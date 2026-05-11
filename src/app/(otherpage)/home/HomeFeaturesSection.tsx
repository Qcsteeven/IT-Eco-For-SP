import Image from 'next/image';
import Link from 'next/link';

import './home-features.scss';

type Feature = {
  title: string;
  body: string;
  iconSrc: string;
};

const TOP: Feature[] = [
  {
    title: 'Агрегатор площадок',
    body: 'Подключи аккаунты Codeforces и AtCoder, чтобы видеть объединенный рейтинг, историю контестов и статистику без переключения между сайтами.',
    iconSrc: '/home-assets/features/icon-integrations.svg',
  },
  {
    title: 'ИИ-ассистент',
    body: 'Задай вопрос и получи ответ. Ассистент помогает с разбором задач, поиском материалов и подготовкой к соревнованиям.',
    iconSrc: '/home-assets/features/icon-aggregator-extra.svg',
  },
];

const BOTTOM: Feature[] = [
  {
    title: 'Система кармы',
    body: 'Объединенный рейтинг учитывает достижения на разных платформах. Рост на одной площадке повышает общий профиль участника.',
    iconSrc: '/home-assets/features/icon-approval.svg',
  },
  {
    title: 'Календарь соревнований',
    body: 'Ближайшие контесты Codeforces, AtCoder и внутренних мероприятий собраны в одном календаре с актуальными ссылками.',
    iconSrc: '/home-assets/features/icon-info.svg',
  },
  {
    title: 'Создание соревнований',
    body: 'Тренеры могут организовывать внутренние мероприятия, назначать группы, следить за участием и результатами.',
    iconSrc: '/home-assets/features/icon-application.svg',
  },
];

function FeatureCard({
  title,
  body,
  iconSrc,
  small,
}: Feature & { small?: boolean }) {
  return (
    <article className={`feature-card ${small ? 'feature-card--small' : ''}`}>
      <Image
        className="feature-card__icon"
        src={iconSrc}
        alt=""
        width={56}
        height={56}
        aria-hidden="true"
      />
      <h3 className="feature-card__title">{title}</h3>
      <p className="feature-card__text">{body}</p>
    </article>
  );
}

export default function HomeFeaturesSection() {
  return (
    <section className="home-features" aria-labelledby="home-features-title">
      <div className="home-features__inner">
        <h2 id="home-features-title" className="home-features__title">
          Все для спортсмена-программиста в одном месте
        </h2>
        <p className="home-features__lead">
          Мы собираем данные с разных площадок, добавляем ИИ-помощника и
          инструменты, которых обычно не хватает на отдельных платформах.
        </p>

        <div className="home-features__grid-top">
          {TOP.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>

        <div className="home-features__grid-bottom">
          {BOTTOM.map((feature) => (
            <FeatureCard key={feature.title} {...feature} small />
          ))}
        </div>

        <Link href="/profile" className="home-features__cta">
          Подключить свои аккаунты
          <Image
            className="home-features__cta-icon"
            src="/home-assets/features/arrow-link.svg"
            alt=""
            width={18}
            height={18}
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  );
}
