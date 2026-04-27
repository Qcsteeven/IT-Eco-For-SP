'use client';

import Image from 'next/image';
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import './home-partners.scss';

type Partner = {
  name: string;
  logoSrc: string;
};

// NOTE: Figma MCP sometimes returns these as remote assets; we keep them local in /public.
const PARTNERS: Partner[] = [
  { name: 'ИРНИТУ', logoSrc: '/home-assets/partners/irnitu.png' },
  { name: 'Яндекс', logoSrc: '/home-assets/partners/yandex.png' },
  { name: 'AtCoder', logoSrc: '/home-assets/partners/atcoder.png' },
];

function wrapIndex(i: number, len: number) {
  if (len === 0) return 0;
  return ((i % len) + len) % len;
}

export default function HomePartnersCarousel() {
  const [active, setActive] = useState(0);

  const visible = useMemo(() => {
    if (PARTNERS.length === 0) return [];
    return [-1, 0, 1].map((offset) => PARTNERS[wrapIndex(active + offset, PARTNERS.length)]);
  }, [active]);

  const canNav = PARTNERS.length > 1;

  return (
    <section className="home-partners" aria-labelledby="home-partners-title">
      <div className="home-partners__inner">
        <h2 id="home-partners-title" className="home-partners__title">
          НАШИ ПАРТНЁРЫ
        </h2>

        <div className="home-partners__stage" aria-label="Витрина партнёров">
          <button
            type="button"
            className="home-partners__nav"
            onClick={() => setActive((a) => wrapIndex(a - 1, PARTNERS.length))}
            disabled={!canNav}
            aria-label="Предыдущий партнёр"
          >
            <ChevronLeft />
          </button>

          <div className="home-partners__list">
            {visible.map((p) => (
              <div key={p.name} className="home-partners__logo" title={p.name}>
                <Image src={p.logoSrc} alt={p.name} width={220} height={80} />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="home-partners__nav"
            onClick={() => setActive((a) => wrapIndex(a + 1, PARTNERS.length))}
            disabled={!canNav}
            aria-label="Следующий партнёр"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </section>
  );
}

