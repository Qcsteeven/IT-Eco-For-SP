'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { hasPermission, UserRole } from '@/lib/rbac';
import './header.scss';

export default function Header() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;

  return (
    <>
      <div className="header-ghost"></div>
      <header className="header">
        <div className="header-wrapper">
          <div className="header-logo">БЦСП</div>
          <ul className="header-links">
            <Link href="/home" className="header-links-item">
              Главная
            </Link>
            <Link href="/base" className="header-links-item">
              База знаний
            </Link>
            <Link href="/calendar" className="header-links-item">
              Календарь
            </Link>
            {status === 'authenticated' && (
              <>
                {userRole && hasPermission(userRole, 'canUseAIAssistant') && (
                  <Link href="/chat" className="header-links-item">
                    ИИ Ассистент
                  </Link>
                )}
                {userRole && hasPermission(userRole, 'canViewPersonalDashboard') && (
                  <Link href="/profile" className="header-links-item">
                    Профиль
                  </Link>
                )}
                {userRole && hasPermission(userRole, 'canManageContests') && (
                  <Link href="/coach/contests" className="header-links-item">
                    Контесты
                  </Link>
                )}
                {userRole && hasPermission(userRole, 'canViewAnalytics') && (
                  <Link href="/coach/analytics" className="header-links-item">
                    Аналитика
                  </Link>
                )}
                {userRole && hasPermission(userRole, 'canManageUsers') && (
                  <Link href="/admin" className="header-links-item header-links-item-admin">
                    Админ
                  </Link>
                )}
              </>
            )}
            {status === 'unauthenticated' && (
              <Link href="/auth/signin" className="header-links-item">
                Вход / Регистрация
              </Link>
            )}
          </ul>
        </div>
      </header>
    </>
  );
}
