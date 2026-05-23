import Link from 'next/link';
import { Home, Terminal, Undo2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import './not-found.scss';

export default function NotFound() {
  return (
    <div className="not-found-layout">
      <Header />
      <main className="not-found-page">
        <section className="not-found-page__content" aria-labelledby="not-found-title">
          <div className="not-found-page__code">
            <Terminal size={36} aria-hidden="true" />
            <span>404</span>
          </div>

          <h1 id="not-found-title">Упс! Решение не найдено</h1>
          <p className="not-found-page__subtitle">(Runtime Error)</p>
          <p className="not-found-page__text">
            Эко проверил стек вызовов, но такой страницы в системе нет. Можно
            вернуться на главную и продолжить маршрут оттуда.
          </p>

          <div className="not-found-page__actions">
            <Link href="/home" className="not-found-page__primary">
              <Home size={20} />
              Вернуться на главную
            </Link>
            <Link href="/calendar" className="not-found-page__secondary">
              <Undo2 size={20} />
              К календарю
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
