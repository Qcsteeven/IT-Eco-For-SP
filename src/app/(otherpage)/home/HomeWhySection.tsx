import './home-why-section.scss';

const CARDS = [
  {
    illustration: '/home-assets/why-section/card-1.svg',
    title: 'Подготовка к собеседованиям в BigTech',
    body: 'Ты научишься решать алгоритмические задачи уровня Яндекс, Google и TikTok. Это база, которую проверяют во всех топовых IT-компаниях мира.',
  },
  {
    illustration: '/home-assets/why-section/card-4.svg',
    title: 'Сильное IT-сообщество и нетворкинг',
    body: 'Ты попадаешь в среду сильных разработчиков. Командные тренировки и олимпиады — это тысячи единомышленников и полезных связей.',
  },
  {
    illustration: '/home-assets/why-section/card-2.svg',
    title: 'Карьерный лифт и рейтинг Codeforces',
    body: 'Высокий рейтинг на Codeforces — это знак качества для рекрутеров. Многие компании напрямую ищут таланты среди участников олимпиад.',
  },
  {
    illustration: '/home-assets/why-section/card-3.svg',
    title: 'Бесплатный старт и доступность',
    body: 'Начать можно прямо сейчас: нужен только компьютер и интернет. Большинство ведущих площадок и материалов полностью бесплатны.',
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
