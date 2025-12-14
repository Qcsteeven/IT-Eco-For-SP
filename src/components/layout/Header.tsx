import Link from 'next/link';
import './header.scss';


export default function Header() {
  return (
    <>
      <div className="header-ghost"></div>
      <header className="header">
        <div className="header-wrapper">
          <div className="header-logo">
            БЦСП
          </div>
          <ul className="header-links">
            <Link href="/home" className="header-links-item">
              Главная
            </Link>
            <Link href="/docs" className="header-links-item">
              База знаний
            </Link>
            <Link href="/calendar" className="header-links-item">
              Календарь
            </Link>
            <Link href="/profile" className="header-links-item">
              Профиль
            </Link>
          </ul>
        </div>
      </header>
    </>
  )
}