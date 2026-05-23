'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CalendarCheck, MoveRight, ShieldCheck } from 'lucide-react';
import { useRoleGuard } from '@/lib/rbac/client';
import '../coach.scss';

export default function CoachContestsPage() {
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
        <Link href="/coach">Вернуться</Link>
      </div>
    );
  }

  return (
    <main className="coach-page">
      <div className="coach-container">
        <header className="coach-title-row" aria-labelledby="contests-title">
          <p>
            <ShieldCheck aria-hidden="true" size={18} />
            Тренерская панель
          </p>
          <h1 id="contests-title">Контесты и мероприятия</h1>
        </header>

        <section className="coach-panel coach-redirect-panel">
          <span className="coach-panel-icon">
            <CalendarCheck aria-hidden="true" size={26} />
          </span>
          <div>
            <h2>Управление контестами теперь в мероприятиях</h2>
            <p>
              Создание, редактирование и назначение групп собраны в едином
              рабочем экране.
            </p>
          </div>
          <Link href="/coach/events" className="coach-btn coach-btn--primary">
            Открыть мероприятия
            <MoveRight aria-hidden="true" size={18} />
          </Link>
        </section>
      </div>
    </main>
  );
}
