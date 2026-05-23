'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import PreviousPageLink from '@/components/PreviousPageLink';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './coach.scss';

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
        <h1>Доступ запрещён</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/dashboard">Вернуться</Link>
      </div>
    );
  }

  return (
    <div className="coach-page">
      <div className="coach-container">
        <div className="coach-header">
          <PreviousPageLink fallbackHref="/home" className="coach-back-link" />
          <div className="coach-header-content">
            <h1>Тренерская</h1>
          </div>
        </div>

        <div className="coach-section">
          <h2>Разделы</h2>
          <div className="coach-coach-links">
            <Link className="coach-btn coach-btn-primary" href="/coach/events">
              Мероприятия
            </Link>
            <Link className="coach-btn coach-btn-secondary" href="/coach/groups">
              Группы
            </Link>
          </div>
        </div>
      </div>
      <style jsx>{`
        .coach-coach-links {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}

