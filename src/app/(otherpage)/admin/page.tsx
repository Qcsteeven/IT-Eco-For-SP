'use client';

import { useSession } from 'next-auth/react';
import { useRoleGuard } from '@/lib/rbac/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import './admin.scss';

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
        <h1>Доступ запрещён</h1>
        <p>У вас недостаточно прав для просмотра этой страницы.</p>
        <Link href="/dashboard">Вернуться на дашборд</Link>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-container">
        <h1>Панель администратора</h1>
        <p className="admin-subtitle">Управление системой и пользователями</p>

        <div className="admin-grid">
          <Link href="/admin/users" className="admin-card">
            <div className="admin-card-icon">👥</div>
            <h3>Управление пользователями</h3>
            <p>Просмотр, редактирование и удаление пользователей</p>
          </Link>

          <Link href="/admin/karma" className="admin-card">
            <div className="admin-card-icon">⭐</div>
            <h3>Корректировка кармы</h3>
            <p>Ручное изменение кармы пользователей</p>
          </Link>

          <Link href="/coach/events?from=admin" className="admin-card">
            <div className="admin-card-icon">🏆</div>
            <h3>Управление контестами</h3>
            <p>Создание, редактирование и управление мероприятиями</p>
          </Link>
        </div>

        <div className="admin-section">
          <h2>Быстрые действия</h2>
          <div className="admin-actions">
            <button className="admin-btn admin-btn-primary">
              + Добавить пользователя
            </button>
            <button className="admin-btn admin-btn-secondary">
              📥 Экспорт данных
            </button>
            <button className="admin-btn admin-btn-secondary">
              ⚙️ Настройки системы
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
