'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';

import { ApiResponse } from '@/lib/types/api';

import './home-contests-carousel.scss';

type Contest = {
  id: string;
  title: string;
  platform: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link?: string;
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function wrapIndex(i: number, len: number) {
  if (len === 0) return 0;
  return ((i % len) + len) % len;
}

const POSITIONS = [
  { offset: -2, className: 'home-contests__card--far-left' },
  { offset: -1, className: 'home-contests__card--near-left' },
  { offset: 0, className: 'home-contests__card--center' },
  { offset: 1, className: 'home-contests__card--near-right' },
  { offset: 2, className: 'home-contests__card--far-right' },
] as const;

export default function HomeContestsCarousel() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch('/api/contests', { cache: 'no-store' });
        const json = (await resp.json()) as ApiResponse<Contest[]>;
        if (!mounted) return;
        if (!resp.ok || !json.ok || !json.data) {
          setError(json.error || 'Не удалось загрузить соревнования.');
          setContests([]);
          return;
        }
        setContests(json.data);
        setActive(0);
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
        setContests([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visible = useMemo(() => {
    const len = contests.length;
    if (len === 0) return [];
    const raw = POSITIONS.map((p) => {
      const idx = wrapIndex(active + p.offset, len);
      return { pos: p, contest: contests[idx], idx };
    });

    // When contests are fewer than 5, indices may repeat; drop duplicates to keep keys stable.
    const seen = new Set<number>();
    return raw.filter((item) => {
      if (seen.has(item.idx)) return false;
      seen.add(item.idx);
      return true;
    });
  }, [active, contests]);

  const canNav = contests.length > 1;
  const goPrev = () => canNav && setActive((a) => wrapIndex(a - 1, contests.length));
  const goNext = () => canNav && setActive((a) => wrapIndex(a + 1, contests.length));

  return (
    <section className="home-contests" aria-labelledby="home-contests-title">
      <div className="home-contests__inner">
        <h2 id="home-contests-title" className="home-contests__title">
          Ближайшие соревнования
        </h2>

        {loading && <div className="home-contests__state">Загрузка...</div>}
        {!loading && error && (
          <div className="home-contests__state">Ошибка загрузки: {error}</div>
        )}
        {!loading && !error && contests.length === 0 && (
          <div className="home-contests__state">Нет запланированных соревнований.</div>
        )}

        {!loading && !error && contests.length > 0 && (
          <>
            <div className="home-contests__stage" aria-label="Витрина соревнований">
              {visible.map(({ pos, contest }) => (
                <article
                  // idx can repeat when contests.length < 5; include offset class for uniqueness
                  key={contest.id}
                  className={`home-contests__card ${pos.className}`}
                  aria-hidden={pos.offset !== 0}
                >
                  <div className="home-contests__content">
                    <h3 className="home-contests__card-title">
                      {contest.title.replace(' ', '\n')}
                    </h3>

                    <div className="home-contests__platform">
                      <img
                        className="home-contests__bell"
                        src="/home-assets/contests/icon-bell.svg"
                        alt=""
                        aria-hidden="true"
                      />
                      <span>[{contest.platform}]</span>
                    </div>

                    <div className="home-contests__dates">
                      {`Начало:\n${formatDate(contest.start_time_utc)}\n\nОкончание:\n${formatDate(contest.end_time_utc)}`}
                    </div>

                    {contest.registration_link ? (
                      <a
                        className="home-contests__cta"
                        href={contest.registration_link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Регистрация
                        <img
                          className="home-contests__cta-arrow"
                          src="/home-assets/contests/icon-reg-arrow-lg.svg"
                          alt=""
                          aria-hidden="true"
                        />
                      </a>
                    ) : (
                      <span className="home-contests__cta" style={{ opacity: 0.6 }}>
                        Регистрация
                        <img
                          className="home-contests__cta-arrow"
                          src="/home-assets/contests/icon-reg-arrow-lg.svg"
                          alt=""
                          aria-hidden="true"
                        />
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="home-contests__nav" aria-label="Навигация витрины">
              <button
                type="button"
                className="home-contests__nav-btn home-contests__nav-btn--prev"
                onClick={goPrev}
                disabled={!canNav}
                aria-label="Предыдущее соревнование"
              >
                <img
                  className="home-contests__nav-icon"
                  src="/home-assets/contests/nav-chevron-left.svg"
                  alt=""
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="home-contests__nav-btn home-contests__nav-btn--next"
                onClick={goNext}
                disabled={!canNav}
                aria-label="Следующее соревнование"
              >
                <img
                  className="home-contests__nav-icon"
                  src="/home-assets/contests/nav-chevron-right.svg"
                  alt=""
                  aria-hidden="true"
                />
              </button>
            </div>

            <Link href="/calendar" className="home-contests__all">
              Посмотреть все соревнования →
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

