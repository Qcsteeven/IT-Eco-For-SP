'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import './header.scss';

export default function Header() {
  const { status } = useSession();
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

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
            <Link
              href="/chat"
              className={`header-nav-item ${isActive('/chat') ? 'is-active' : ''}`}
            >
              ИИ - ассистент
            </Link>
          </nav>

          <Link
            href={status === 'authenticated' ? '/profile' : '/auth/signin'}
            className="header-profile"
            aria-label={
              status === 'authenticated'
                ? 'Открыть профиль'
                : 'Вход или регистрация'
            }
          >
            <Image
              src="/home-assets/hero/profile-icon.png"
              alt=""
              width={40}
              height={40}
            />
          </Link>
        </div>
      </header>
    </>
  );
}
