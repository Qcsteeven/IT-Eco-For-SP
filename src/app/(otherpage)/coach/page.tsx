'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  CalendarCheck,
  ChevronRight,
  UsersRound,
} from 'lucide-react';
import { useEffect } from 'react';

import { useRoleGuard } from '@/lib/rbac/client';

import './coach.scss';

const COACH_SECTIONS = [
  {
    href: '/coach/events',
    title: 'Мероприятия',
    description:
      'Создавайте события, назначайте группы и управляйте расписанием тренировок.',
    icon: CalendarCheck,
  },
  {
    href: '/coach/groups',
    title: 'Группы',
    description:
      'Собирайте участников в группы, следите за составом и переходите к аналитике.',
    icon: UsersRound,
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
        <Link href="/dashboard">Вернуться</Link>
      </div>
    );
  }

  return (
    <main className="coach-page coach-home-page">
      <div className="coach-container">
        <Link href="/home" className="coach-home-back">
          <ArrowLeft aria-hidden="true" size={18} />
          Назад
        </Link>

        <section className="coach-home-hero" aria-labelledby="coach-title">
          <p className="coach-home-eyebrow">Рабочее пространство тренера</p>
          <h1 id="coach-title">Тренерская</h1>
          <p>
            Управляйте учебными группами и мероприятиями в одном месте. Экран
            повторяет структуру макета, но ведет в реальные разделы системы.
          </p>
        </section>

        <section className="coach-home-grid" aria-label="Разделы тренерской">
          {COACH_SECTIONS.map((section) => {
            const Icon = section.icon;

            return (
              <Link
                key={section.href}
                href={section.href}
                className="coach-home-card"
              >
                <span className="coach-home-card__icon">
                  <Icon aria-hidden="true" size={28} />
                </span>
                <span className="coach-home-card__content">
                  <h2>{section.title}</h2>
                  <p>{section.description}</p>
                </span>
                <ChevronRight
                  className="coach-home-card__arrow"
                  aria-hidden="true"
                  size={22}
                />
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
