'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  CalendarCheck,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect } from 'react';

import { useRoleGuard } from '@/lib/rbac/client';

import './admin.scss';

const MANAGEMENT_CARDS = [
  {
    href: '/admin/users',
    title: 'Пользователи',
    text: 'Создание аккаунтов, роли, блокировка и ручная настройка рейтинга.',
    icon: Users,
  },
  {
    href: '/admin/karma',
    title: 'Корректировка кармы',
    text: 'Ручные правки кармы с понятным контекстом для администратора.',
    icon: Star,
  },
  {
    href: '/coach/events',
    title: 'Мероприятия',
    text: 'Контроль внутренних событий, групп участников и расписания.',
    icon: CalendarCheck,
  },
] as const;

const QUICK_ACTIONS = [
  {
    href: '/admin/users',
    title: 'Добавить пользователя',
    icon: UserPlus,
  },
  {
    href: '/admin/karma',
    title: 'Изменить карму',
    icon: Sparkles,
  },
  {
    href: '/coach/events',
    title: 'Открыть мероприятия',
    icon: CalendarCheck,
  },
] as const;

export default function AdminDashboardPage() {
  const { status } = useSession();
  const { authorized, isLoading } = useRoleGuard('admin');
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !authorized && status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [authorized, isLoading, router, status]);

  if (status === 'loading' || isLoading) {
    return <div className="admin-loading">Загрузка...</div>;
  }

  if (!authorized) {
    return (
      <div className="admin-access-denied">
        <h1>Доступ запрещен</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/dashboard">Вернуться на дашборд</Link>
      </div>
    );
  }

  return (
    <main className="admin-dashboard">
      <div className="admin-container">
        <section className="admin-hero" aria-labelledby="admin-title">
          <div>
            <p className="admin-eyebrow">
              <ShieldCheck aria-hidden="true" size={18} />
              Администрирование
            </p>
            <h1 id="admin-title">Панель администратора</h1>
            <p className="admin-subtitle">
              Управляйте пользователями, кармой и мероприятиями из одного
              рабочего экрана.
            </p>
          </div>
        </section>

        <section className="admin-grid" aria-label="Разделы администрирования">
          {MANAGEMENT_CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <Link key={card.href} href={card.href} className="admin-card">
                <span className="admin-card-icon">
                  <Icon aria-hidden="true" size={24} />
                </span>
                <span>
                  <h2>{card.title}</h2>
                  <p>{card.text}</p>
                </span>
              </Link>
            );
          })}
        </section>

        <section
          className="admin-section"
          aria-labelledby="admin-actions-title"
        >
          <div>
            <h2 id="admin-actions-title">Быстрые действия</h2>
            <p>
              Частые задачи вынесены отдельно, чтобы не искать их по разделам.
            </p>
          </div>

          <div className="admin-actions">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="admin-btn"
                >
                  <Icon aria-hidden="true" size={18} />
                  {action.title}
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
