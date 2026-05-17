'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowRight,
  CalendarCheck,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useEffect } from 'react';

import { useRoleGuard } from '@/lib/rbac/client';

import './coach.scss';

const COACH_SECTIONS = [
  {
    href: '/coach/groups',
    title: 'Группы',
    text: 'Создание учебных групп, управление составом и быстрый переход к аналитике.',
    icon: UsersRound,
    tone: 'violet',
  },
  {
    href: '/coach/events',
    title: 'Мероприятия',
    text: 'Планирование событий, назначение групп и синхронизация результатов участников.',
    icon: CalendarCheck,
    tone: 'green',
  },
] as const;

export default function CoachHomePage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('coach');
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  if (status === 'loading' || isLoading) {
    return <div className="coach-loading">Загрузка...</div>;
  }

  if (!authorized) {
    return (
      <div className="coach-access-denied">
        <h1>Доступ запрещен</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/dashboard">Вернуться на дашборд</Link>
      </div>
    );
  }

  return (
    <main className="coach-dashboard">
      <div className="coach-container">
        <header className="coach-title-row" aria-labelledby="coach-title">
          <p>
            <ShieldCheck aria-hidden="true" size={18} />
            Рабочее пространство тренера
          </p>
          <h1 id="coach-title">Тренерская панель</h1>
        </header>

        <section className="coach-grid" aria-label="Разделы тренерской панели">
          {COACH_SECTIONS.map((section) => {
            const Icon = section.icon;

            return (
              <Link
                key={section.href}
                href={section.href}
                className={`coach-card coach-card--${section.tone}`}
              >
                <span className="coach-card__icon">
                  <Icon aria-hidden="true" size={30} />
                </span>
                <span>
                  <h2>{section.title}</h2>
                  <p>{section.text}</p>
                </span>
                <ArrowRight
                  className="coach-card__arrow"
                  aria-hidden="true"
                  size={24}
                />
              </Link>
            );
          })}
        </section>

        <section className="coach-actions-section">
          <h2>Быстрые действия</h2>
          <div className="coach-actions">
            <Link href="/coach/groups" className="coach-btn coach-btn--primary">
              <UsersRound aria-hidden="true" size={18} />
              Открыть группы
            </Link>
            <Link
              href="/coach/events"
              className="coach-btn coach-btn--secondary"
            >
              <CalendarCheck aria-hidden="true" size={18} />
              Открыть мероприятия
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
