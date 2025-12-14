// components/SessionWrapper.js
'use client'; // Обязательно, так как next-auth/react использует хуки

import { SessionProvider } from 'next-auth/react';

export default function SessionWrapper({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}