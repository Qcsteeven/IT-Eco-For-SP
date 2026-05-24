// src/app/layout.tsx

import type { Metadata, Viewport } from 'next';
import './globals.css';
// 👈 Импортируем наш клиентский компонент-обертку
import SessionWrapper from '../components/SessionWrapper';
import { chetty, stengazeta } from './fonts';

export const metadata: Metadata = {
  title: {
    default: 'CPCore',
    template: '%s | CPCore',
  },
  description:
    'Платформа для спортивного программирования с календарём соревнований, рейтингами и ИИ-ассистентом.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/brand/cpcore-logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${chetty.variable} ${stengazeta.variable} antialiased`}>
        {/* 👈 Оборачиваем здесь: SessionProvider теперь доступен для всех дочерних элементов */}
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
