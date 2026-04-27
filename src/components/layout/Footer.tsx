import Link from 'next/link';
import './footer.scss';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__about">
          <p className="site-footer__about-text">
            IT-Eco-For-SP — платформа для спортсменов программистов с
            ИИ-ассистентом, агрегацией рейтингов и календарём соревнований
          </p>
        </div>

        <nav className="site-footer__nav" aria-label="Навигация в футере">
          <div className="site-footer__nav-title">Навигация</div>
          <div className="site-footer__nav-line" aria-hidden="true" />
          <ul className="site-footer__nav-list">
            <li>
              <Link href="/home">Главная</Link>
            </li>
            <li>
              <Link href="/base">База знаний</Link>
            </li>
            <li>
              <Link href="/chat">ИИ-ассистент</Link>
            </li>
            <li>
              <Link href="/calendar">Календарь соревнований</Link>
            </li>
            <li>
              <Link href="/profile">Профиль</Link>
            </li>
          </ul>
        </nav>

        <div className="site-footer__bottom">
          <div className="site-footer__copyright">
            © {currentYear} IT-Eco-For-SP. Все права защищены.
          </div>
          <div className="site-footer__email">support@it-eco-for-sp.ru</div>
        </div>
      </div>
    </footer>
  );
}