'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

interface PreviousPageLinkProps {
  className?: string;
  fallbackHref: string;
  children?: ReactNode;
}

export default function PreviousPageLink({
  className,
  fallbackHref,
  children = '← Назад',
}: PreviousPageLinkProps) {
  return (
    <Link href={fallbackHref} className={className}>
      {children}
    </Link>
  );
}
