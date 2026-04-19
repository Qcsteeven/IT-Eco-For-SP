'use client';

import React from 'react';
import './CodeforcesProblems.scss';

interface Problem {
  contestId: number;
  problemIndex: string;
  problemName?: string;
  solvedAt: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
  karma: number;
  tags?: string[];
  rating?: number;
}

interface CodeforcesProblemsProps {
  problems: Problem[];
  karma: number;
  karmaLevel: string;
  karmaColor: string;
  details: {
    totalSolved: number;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
    unknownCount?: number;
  };
  onClose: () => void;
}

const CodeforcesProblems: React.FC<CodeforcesProblemsProps> = ({
  problems,
  karma,
  karmaLevel,
  karmaColor,
  details,
  onClose,
}) => {
  // Состояние для фильтрации по сложности
  const [filterDifficulty, setFilterDifficulty] = React.useState<
    'all' | 'easy' | 'medium' | 'hard' | 'unknown'
  >('all');

  // Фильтруем задачи по выбранной сложности
  const filteredProblems =
    filterDifficulty === 'all'
      ? problems
      : problems.filter((p) => p.difficulty === filterDifficulty);
  // Форматируем дату
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Получаем цвет для сложности
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '#28a745';
      case 'medium':
        return '#007bff';
      case 'hard':
        return '#dc3545';
      default:
        return '#666';
    }
  };

  // Получаем цвет для кармы
  const getKarmaColor = (karma: number) => {
    if (karma >= 10) return '#dc3545';
    if (karma >= 3) return '#007bff';
    return '#28a745';
  };

  return (
    <div className="cf-problems-overlay" onClick={onClose}>
      <div className="cf-problems-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cf-problems-close" onClick={onClose}>
          ×
        </button>

        {/* Заголовок */}
        <h2 className="cf-problems-title">Решённые задачи Codeforces</h2>

        {/* Статистика сверху */}
        <div className="cf-stats-header">
          <div className="cf-karma-main" style={{ color: karmaColor }}>
            <div className="cf-karma-value">{karma}</div>
            <div className="cf-karma-level">{karmaLevel}</div>
          </div>

          <div className="cf-stats-grid">
            <div
              className={`cf-stat-card ${filterDifficulty === 'all' ? 'active' : ''}`}
              onClick={() => setFilterDifficulty('all')}
              style={{ cursor: 'pointer' }}
            >
              <div className="cf-stat-value">{details.totalSolved}</div>
              <div className="cf-stat-label">Всего задач</div>
            </div>
            <div
              className={`cf-stat-card ${filterDifficulty === 'easy' ? 'active' : ''}`}
              onClick={() => setFilterDifficulty('easy')}
              style={{ cursor: 'pointer', borderColor: '#28a745' }}
            >
              <div className="cf-stat-value" style={{ color: '#28a745' }}>
                {details.easyCount}
              </div>
              <div className="cf-stat-label">Легкие</div>
            </div>
            <div
              className={`cf-stat-card ${filterDifficulty === 'medium' ? 'active' : ''}`}
              onClick={() => setFilterDifficulty('medium')}
              style={{ cursor: 'pointer', borderColor: '#007bff' }}
            >
              <div className="cf-stat-value" style={{ color: '#007bff' }}>
                {details.mediumCount}
              </div>
              <div className="cf-stat-label">Средние</div>
            </div>
            <div
              className={`cf-stat-card ${filterDifficulty === 'hard' ? 'active' : ''}`}
              onClick={() => setFilterDifficulty('hard')}
              style={{ cursor: 'pointer', borderColor: '#dc3545' }}
            >
              <div className="cf-stat-value" style={{ color: '#dc3545' }}>
                {details.hardCount}
              </div>
              <div className="cf-stat-label">Сложные</div>
            </div>
            {details.unknownCount !== undefined && details.unknownCount > 0 && (
              <div
                className={`cf-stat-card ${filterDifficulty === 'unknown' ? 'active' : ''}`}
                onClick={() => setFilterDifficulty('unknown')}
                style={{ cursor: 'pointer', borderColor: '#6c757d' }}
              >
                <div className="cf-stat-value" style={{ color: '#6c757d' }}>
                  {details.unknownCount}
                </div>
                <div className="cf-stat-label">Без рейтинга</div>
              </div>
            )}
          </div>
        </div>

        {/* Список задач снизу */}
        <div className="cf-problems-content">
          <h3 className="cf-problems-subtitle">
            Все задачи ({filteredProblems.length}
            {filterDifficulty !== 'all' ? ` из ${problems.length}` : ''})
          </h3>

          {filteredProblems.length === 0 ? (
            <div className="cf-no-problems">
              <p>Нет задач выбранной сложности</p>
              <button
                onClick={() => setFilterDifficulty('all')}
                className="cf-clear-filter"
              >
                Показать все задачи
              </button>
            </div>
          ) : (
            <div className="cf-problems-table">
              <div className="cf-problems-header">
                <div className="cf-col-date">Дата</div>
                <div className="cf-col-problem">Задача</div>
                <div className="cf-col-difficulty">Сложность</div>
                <div className="cf-col-rating">Рейтинг</div>
                <div className="cf-col-tags">Теги</div>
                <div className="cf-col-karma">Карма</div>
              </div>

              {filteredProblems.map((problem, idx) => (
                <a
                  key={idx}
                  href={`https://codeforces.com/problemset/problem/${problem.contestId}/${problem.problemIndex}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cf-problem-row"
                >
                  <div className="cf-col-date">
                    {formatDate(problem.solvedAt)}
                  </div>
                  <div className="cf-col-problem">
                    <span className="cf-problem-index">
                      {problem.problemIndex}
                    </span>
                    <span className="cf-problem-name">
                      {problem.problemName}
                    </span>
                    <span className="cf-contest-id">#{problem.contestId}</span>
                  </div>
                  <div className="cf-col-difficulty">
                    <span
                      className="cf-difficulty-badge"
                      style={{
                        backgroundColor: getDifficultyColor(problem.difficulty),
                        color: '#fff',
                      }}
                    >
                      {problem.difficulty === 'easy' && 'Легкая'}
                      {problem.difficulty === 'medium' && 'Средняя'}
                      {problem.difficulty === 'hard' && 'Сложная'}
                    </span>
                  </div>
                  <div className="cf-col-rating">
                    {problem.rating ? (
                      <span className="cf-rating-badge">{problem.rating}</span>
                    ) : (
                      <span className="cf-rating-unknown">∼</span>
                    )}
                  </div>
                  <div className="cf-col-tags">
                    {problem.tags && problem.tags.length > 0 ? (
                      <div className="cf-tags-container">
                        {problem.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="cf-tag-badge">
                            {tag}
                          </span>
                        ))}
                        {problem.tags.length > 3 && (
                          <span className="cf-tag-more">
                            +{problem.tags.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="cf-tags-none">-</span>
                    )}
                  </div>
                  <div className="cf-col-karma">
                    <span
                      className="cf-karma-badge"
                      style={{
                        backgroundColor: getKarmaColor(problem.karma),
                        color: '#fff',
                      }}
                    >
                      +{problem.karma}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeforcesProblems;
