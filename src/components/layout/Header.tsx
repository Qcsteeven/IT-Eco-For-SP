'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { User } from 'lucide-react';
import { hasPermission, UserRole } from '@/lib/rbac';
import './header.scss';

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;
  const userRole = session?.user?.role as UserRole | undefined;

  return (
    <>
      <div className="header-ghost"></div>
      <header className="header">
        <div className="header-wrapper">
          <Link href="/home" className="header-logo" aria-label="IT-Eco-For-SP">
            <Image
              src="/home-assets/hero/logo-full.png"
              alt="IT-Eco-For-SP"
              width={354}
              height={236}
              priority
            />
          </Link>

          <nav className="header-nav" aria-label="Навигация">
            <Link
              href="/home"
              className={`header-nav-item ${isActive('/home') ? 'is-active' : ''}`}
            >
              Главная
            </Link>
            <Link
              href="/base"
              className={`header-nav-item ${isActive('/base') ? 'is-active' : ''}`}
            >
              База знаний
            </Link>
            <Link
              href="/calendar"
              className={`header-nav-item ${isActive('/calendar') ? 'is-active' : ''}`}
            >
              Календарь
            </Link>

            {status === 'authenticated' &&
              userRole &&
              hasPermission(userRole, 'canUseAIAssistant') && (
                <Link
                  href="/chat"
                  className={`header-nav-item ${isActive('/chat') ? 'is-active' : ''}`}
                >
                  ИИ - ассистент
                </Link>
              )}

            {status === 'authenticated' &&
              userRole &&
              hasPermission(userRole, 'canManageContests') && (
                <Link
                  href="/coach"
                  className={`header-nav-item ${isActive('/coach') ? 'is-active' : ''}`}
                >
                  Тренерская
                </Link>
              )}

            {status === 'authenticated' &&
              userRole &&
              hasPermission(userRole, 'canManageUsers') && (
                <Link
                  href="/admin"
                  className={`header-nav-item ${isActive('/admin') ? 'is-active' : ''}`}
                >
                  Админ
                </Link>
              )}
          </nav>

          <Link
            href={
              status === 'authenticated' &&
              userRole &&
              hasPermission(userRole, 'canViewPersonalDashboard')
                ? '/profile'
                : '/auth/signin'
            }
            className="header-profile"
            aria-label={
              status === 'authenticated' &&
              userRole &&
              hasPermission(userRole, 'canViewPersonalDashboard')
                ? 'Открыть профиль'
                : 'Вход или регистрация'
            }
          >
            <User size={32} color="#0b3852" aria-hidden="true" />
          </Link>
        </div>
      </header>
    </>
  );
}
