'use client';

import Link from 'next/link';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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

const PAGE_SIZE = 3;

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HomeContestsCarousel() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadContests() {
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
        setPage(0);
      } catch (e: unknown) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
        setContests([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadContests();

    return () => {
      mounted = false;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(contests.length / PAGE_SIZE));
  const visible = useMemo(
    () => contests.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [contests, page],
  );

  const canNav = totalPages > 1;

  return (
    <section className="home-contests" aria-labelledby="home-contests-title">
      <div className="home-contests__inner">
        <div className="home-contests__header">
          <h2 id="home-contests-title" className="home-contests__title">
            Ближайшие соревнования
          </h2>
          {canNav && (
            <div
              className="home-contests__nav"
              aria-label="Навигация по соревнованиям"
            >
              <button
                type="button"
                className="home-contests__nav-btn"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0}
                aria-label="Предыдущие соревнования"
              >
                <ChevronLeft aria-hidden="true" size={22} />
              </button>
              <span className="home-contests__counter">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                className="home-contests__nav-btn"
                onClick={() =>
                  setPage((current) => Math.min(totalPages - 1, current + 1))
                }
                disabled={page === totalPages - 1}
                aria-label="Следующие соревнования"
              >
                <ChevronRight aria-hidden="true" size={22} />
              </button>
            </div>
          )}
        </div>

        {loading && <div className="home-contests__state">Загрузка...</div>}
        {!loading && error && (
          <div className="home-contests__state">Ошибка загрузки: {error}</div>
        )}
        {!loading && !error && contests.length === 0 && (
          <div className="home-contests__state">
            Нет запланированных соревнований.
          </div>
        )}

        {!loading && !error && contests.length > 0 && (
          <>
            <div
              className="home-contests__grid"
              aria-label="Список ближайших соревнований"
            >
              {visible.map((contest) => (
                <article key={contest.id} className="home-contests__card">
                  <div>
                    <p className="home-contests__platform">
                      {contest.platform}
                    </p>
                    <h3 className="home-contests__card-title">
                      {contest.title}
                    </h3>
                  </div>

                  <dl className="home-contests__dates">
                    <div>
                      <dt>
                        <CalendarDays aria-hidden="true" size={18} />
                        Начало
                      </dt>
                      <dd>{formatDate(contest.start_time_utc)}</dd>
                    </div>
                    <div>
                      <dt>Окончание</dt>
                      <dd>{formatDate(contest.end_time_utc)}</dd>
                    </div>
                  </dl>

                  {contest.registration_link ? (
                    <a
                      className="home-contests__cta"
                      href={contest.registration_link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Регистрация
                      <ExternalLink aria-hidden="true" size={18} />
                    </a>
                  ) : (
                    <span className="home-contests__cta home-contests__cta--disabled">
                      Регистрация скоро
                    </span>
                  )}
                </article>
              ))}
            </div>

            <Link href="/calendar" className="home-contests__all">
              Посмотреть все соревнования
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
