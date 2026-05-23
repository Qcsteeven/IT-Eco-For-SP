import './home-why-section.scss';

const CARDS = [
  {
    illustration: '/home-assets/why-section/card-1.svg',
    title: 'Подготовка к собеседованиям в BigTech',
    body: 'Алгоритмические задачи уровня Яндекса, Google и TikTok развивают базу, которую проверяют во многих сильных IT-компаниях.',
  },
  {
    illustration: '/home-assets/why-section/card-4.svg',
    title: 'Сильное IT-сообщество и нетворкинг',
    body: 'Командные тренировки, олимпиады и разборы помогают учиться рядом с мотивированными разработчиками.',
  },
  {
    illustration: '/home-assets/why-section/card-2.svg',
    title: 'Карьерный рост и рейтинг Codeforces',
    body: 'Высокий рейтинг показывает системность, скорость мышления и умение решать сложные задачи под давлением.',
  },
  {
    illustration: '/home-assets/why-section/card-3.svg',
    title: 'Бесплатный старт и доступность',
    body: 'Начать можно прямо сейчас: нужны только компьютер, интернет и регулярная практика на открытых площадках.',
  },
] as const;

export default function HomeWhySection() {
  return (
    <section className="home-why" aria-labelledby="home-why-title">
      <div className="home-why__inner">
        <h2 id="home-why-title" className="home-why__title">
          Зачем заниматься спортивным программированием?
        </h2>
        <div className="home-why__grid">
          {CARDS.map((card) => (
            <article
              key={card.title}
              className="home-why-card"
              style={{ backgroundImage: `url(${card.illustration})` }}
            >
              <div className="home-why-card__content">
                <h3 className="home-why-card__heading">{card.title}</h3>
                <p className="home-why-card__text">{card.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
