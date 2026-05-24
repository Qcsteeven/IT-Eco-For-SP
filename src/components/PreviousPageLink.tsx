'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <a href={fallbackHref} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
