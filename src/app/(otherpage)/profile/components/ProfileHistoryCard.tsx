import React from 'react';

import type { ContestProblem, HistoryItem, RatingSort } from '../types';

interface ProfileHistoryCardProps {
  visibleHistory: HistoryItem[];
  filteredCount: number;
  platforms: string[];
  dateFrom: string;
  dateTo: string;
  platformFilter: string;
  placeFrom: string;
  placeTo: string;
  ratingSort: RatingSort;
  contestProblems: Record<string, ContestProblem[]>;
  contestProblemsLoading: Record<string, boolean>;
  expandedContestId: string | null;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onPlatformFilterChange: (value: string) => void;
  onPlaceFromChange: (value: string) => void;
  onPlaceToChange: (value: string) => void;
  onRatingSortChange: (value: RatingSort) => void;
  onResetFilters: () => void;
  onContestClick: (
    contestId: string,
    contestName: string,
    platform: string,
  ) => void;
  onLoadMore: () => void;
}

export default function ProfileHistoryCard({
  visibleHistory,
  filteredCount,
  platforms,
  dateFrom,
  dateTo,
  platformFilter,
  placeFrom,
  placeTo,
  ratingSort,
  contestProblems,
  contestProblemsLoading,
  expandedContestId,
  onDateFromChange,
  onDateToChange,
  onPlatformFilterChange,
  onPlaceFromChange,
  onPlaceToChange,
  onRatingSortChange,
  onResetFilters,
  onContestClick,
  onLoadMore,
}: ProfileHistoryCardProps) {
  return (
    <div className="profile-history-card">
      <div className="profile-history-card__title">
        История участия в соревнованиях
      </div>

      <div className="profile-history-filters">
        <div className="profile-history-filter">
          <label>Дата (от):</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>
        <div className="profile-history-filter">
          <label>Дата (до):</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>

        <div className="profile-history-filter">
          <label>Платформа:</label>
          <select
            value={platformFilter}
            onChange={(e) => onPlatformFilterChange(e.target.value)}
          >
            <option value="all">Все</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="profile-history-filter">
          <label>Место от:</label>
          <input
            type="number"
            min="1"
            value={placeFrom}
            onChange={(e) => onPlaceFromChange(e.target.value)}
            placeholder="1"
          />
        </div>
        <div className="profile-history-filter">
          <label>Место до:</label>
          <input
            type="number"
            min="1"
            value={placeTo}
            onChange={(e) => onPlaceToChange(e.target.value)}
            placeholder="1000"
          />
        </div>

        <div className="profile-history-filter">
          <label>Рейтинг БЦСП:</label>
          <select
            value={ratingSort}
            onChange={(e) => onRatingSortChange(e.target.value as RatingSort)}
          >
            <option value="none">Без сортировки</option>
            <option value="asc">По возрастанию</option>
            <option value="desc">По убыванию</option>
          </select>
        </div>

        <button
          type="button"
          className="profile-history-reset"
          onClick={onResetFilters}
        >
          Сбросить
        </button>
      </div>

      <table className="profile-history-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Соревнование</th>
            <th>Платформа</th>
            <th>Результат</th>
            <th>Рейтинг БЦСП</th>
          </tr>
        </thead>
        <tbody>
          {visibleHistory.length > 0 ? (
            visibleHistory.map((item, index) => {
              const uniqueKey = item.contest.id
                ? `${item.contest.platform}_${item.contest.id}`
                : null;
              const isExpanded = uniqueKey && expandedContestId === uniqueKey;
              const problems = uniqueKey ? contestProblems[uniqueKey] : null;
              const isLoading = uniqueKey
                ? contestProblemsLoading[uniqueKey]
                : false;

              return (
                <React.Fragment key={index}>
                  <tr className={isExpanded ? 'expanded-row' : ''}>
                    <td>{new Date(item.date_recorded).toLocaleDateString()}</td>
                    <td>
                      {item.contest.id ? (
                        <button
                          className="contest-link"
                          onClick={() =>
                            onContestClick(
                              item.contest.id!,
                              item.contest.title,
                              item.contest.platform,
                            )
                          }
                          type="button"
                        >
                          {isExpanded ? '▼ ' : '▶ '}
                          {item.contest.title}
                        </button>
                      ) : (
                        item.contest.title
                      )}
                    </td>
                    <td>
                      <span
                        className={`platform-badge platform-${item.contest.platform.toLowerCase()}`}
                      >
                        {item.contest.platform === 'Codeforces' && '🔴 '}
                        {item.contest.platform === 'AtCoder' && '🟠 '}
                        {item.contest.platform}
                      </span>
                    </td>
                    <td>
                      {item.placement}
                      {item.is_manual && (
                        <span className="manual-tag">вручную</span>
                      )}
                    </td>
                    <td
                      className={`rating-change ${item.mmr_change < 0 ? 'negative' : ''}`}
                    >
                      {item.mmr_change > 0
                        ? `+${item.mmr_change}`
                        : item.mmr_change}
                    </td>
                  </tr>
                  {isExpanded && uniqueKey && (
                    <tr className="problems-expand-row">
                      <td colSpan={5}>
                        <div className="problems-container">
                          {isLoading ? (
                            <div className="loading-problems">
                              <div className="spinner"></div>
                              <p>Загрузка задач...</p>
                            </div>
                          ) : problems && problems.length > 0 ? (
                            <>
                              <div className="problems-summary">
                                <p>
                                  Решено задач: <strong>{problems.length}</strong>
                                </p>
                              </div>
                              <table className="problems-table">
                                <thead>
                                  <tr>
                                    <th>Индекс</th>
                                    <th>Название</th>
                                    <th>Ссылка</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {problems.map((problem, idx) => (
                                    <tr
                                      key={`${uniqueKey}_${problem.problemIndex}_${idx}`}
                                      className="solved-row"
                                    >
                                      <td className="problem-index">
                                        {problem.problemIndex}
                                      </td>
                                      <td className="problem-name">
                                        {problem.problemName}
                                      </td>
                                      <td>
                                        <a
                                          href={problem.problemUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="problem-link-button"
                                        >
                                          Открыть задачу
                                        </a>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </>
                          ) : (
                            <div className="no-problems">
                              <p>
                                Нет данных о задачах или произошла ошибка при
                                загрузке.
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          ) : (
            <tr>
              <td colSpan={5}>Нет записей, соответствующих фильтрам.</td>
            </tr>
          )}
        </tbody>
      </table>

      {filteredCount > visibleHistory.length && (
        <div className="profile-history-more">
          <button
            type="button"
            className="profile-history-more__btn"
            onClick={onLoadMore}
          >
            Показать еще
          </button>
        </div>
      )}
    </div>
  );
}
