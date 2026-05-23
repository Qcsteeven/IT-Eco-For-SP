'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronDown, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { hasPermission, UserRole } from '@/lib/rbac';
import './header.scss';

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const userRole = session?.user?.role as UserRole | undefined;
  const isAuthenticated = status === 'authenticated' && Boolean(userRole);

  const isActive = (href: string) => pathname === href;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canUseAIAssistant =
    isAuthenticated && userRole && hasPermission(userRole, 'canUseAIAssistant');
  const canViewProfile =
    isAuthenticated && userRole && hasPermission(userRole, 'canViewPersonalDashboard');
  const canManageContests =
    isAuthenticated && userRole && hasPermission(userRole, 'canManageContests');
  const canManageUsers =
    isAuthenticated && userRole && hasPermission(userRole, 'canManageUsers');

  const closeProfileMenu = () => setIsProfileOpen(false);

  return (
    <>
      <div className="header-ghost" />
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

            {canUseAIAssistant && (
              <Link
                href="/chat"
                className={`header-nav-item ${isActive('/chat') ? 'is-active' : ''}`}
              >
                ИИ - ассистент
              </Link>
            )}
          </nav>

          {isAuthenticated ? (
            <div className="header-profile-menu" ref={profileMenuRef}>
              <button
                type="button"
                className="header-profile"
                aria-haspopup="menu"
                aria-expanded={isProfileOpen}
                onClick={() => setIsProfileOpen((open) => !open)}
              >
                <User size={30} color="#0b3852" aria-hidden="true" />
                <ChevronDown size={16} aria-hidden="true" />
                <span className="header-sr-only">Открыть меню профиля</span>
              </button>

              {isProfileOpen && (
                <div className="header-profile-dropdown" role="menu">
                  {canViewProfile && (
                    <Link href="/profile" role="menuitem" onClick={closeProfileMenu}>
                      Личный кабинет
                    </Link>
                  )}
                  {canManageContests && (
                    <Link href="/coach" role="menuitem" onClick={closeProfileMenu}>
                      Тренерская
                    </Link>
                  )}
                  {canManageUsers && (
                    <Link href="/admin" role="menuitem" onClick={closeProfileMenu}>
                      Панель администратора
                    </Link>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/signin"
              className="header-profile"
              aria-label="Вход или регистрация"
            >
              <User size={32} color="#0b3852" aria-hidden="true" />
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
