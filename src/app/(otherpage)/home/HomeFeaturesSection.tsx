import Link from 'next/link';
import Image from 'next/image';

import './home-features.scss';

type Feature = {
  title: string;
  body: string;
  iconSrc: string;
};

const TOP: Feature[] = [
  {
    title: 'Агрегатор площадок',
    body:
      'Подключи аккаунты Codeforces и AtCoder — и смотри объединённый рейтинг, историю\nконтестов и статистику. Без переключения\nмежду сайтами',
    iconSrc: '/home-assets/features/icon-integrations.svg',
  },
  {
    title: 'ИИ-ассистент',
    body:
      'Задай вопрос — получи ответ. ИИ\nзнает актуальные новости, даты\nсоревнований и помогает с разбором\nзадач. Работает на\nбазе Qwen с RAG-поиском',
    iconSrc: '/home-assets/features/icon-aggregator-extra.svg',
  },
];

const BOTTOM: Feature[] = [
  {
    title: 'Система кармы',
    body:
      'Уникальный объединённый\nрейтинг, который учитывает\nваши достижения на всех\nплощадках. Рост на одной\nплатформе = рост общего\nрейтинга',
    iconSrc: '/home-assets/features/icon-approval.svg',
  },
  {
    title: 'Календарь\nсоревнований',
    body:
      'Автоматический календарь\nвсех ближайших\nсоревнований с Codeforces,\nAtCoder и других площадок',
    iconSrc: '/home-assets/features/icon-info.svg',
  },
  {
    title: 'Создание\nсоревнований',
    body:
      'Организируй внутреннее\nсоревнование. Создавай\nзадачи, назначай дедлайны\nи отслеживай\nрезультаты',
    iconSrc: '/home-assets/features/icon-application.svg',
  },
];

function FeatureCard({ title, body, iconSrc, small }: Feature & { small?: boolean }) {
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
          Мы собираем данные со всех площадок, добавляем ИИ-помощника и инструменты,
          которых нет ни на одной платформе.
        </p>

        <div className="home-features__grid-top">
          {TOP.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>

        <div className="home-features__grid-bottom">
          {BOTTOM.map((f) => (
            <FeatureCard key={f.title} {...f} small />
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

