'use client';

import React from 'react';
import './CodeforcesStats.scss';

interface CodeforcesStatsProps {
  karma: number;
  karmaLevel: string;
  karmaColor: string;
  breakdown: {
    easyKarma: number;
    mediumKarma: number;
    hardKarma: number;
    tagBonusKarma: number;
    diversityBonus: number;
  };
  details: {
    totalSolved: number;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
    averageRating: number;
    uniqueTags: number;
  };
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  tagStats: Array<{ tag: string; solvedCount: number; averageRating: number }>;
  onClose: () => void;
}

const CodeforcesStats: React.FC<CodeforcesStatsProps> = ({
  karma,
  karmaLevel,
  karmaColor,
  breakdown,
  details,
  difficultyDistribution,
  tagStats,
  onClose,
}) => {
  const maxTagCount = Math.max(...tagStats.map(t => t.solvedCount), 1);

  return (
    <div className="cf-stats-overlay" onClick={onClose}>
      <div className="cf-stats-modal" onClick={e => e.stopPropagation()}>
        <button className="cf-stats-close" onClick={onClose}>
          ×
        </button>
        
        <h2 className="cf-stats-title">Статистика Codeforces</h2>
        
        {/* Основной блок с кармой */}
        <div className="cf-karma-main">
          <div 
            className="cf-karma-value" 
            style={{ color: karmaColor }}
          >
            {karma}
          </div>
          <div 
            className="cf-karma-level" 
            style={{ color: karmaColor }}
          >
            {karmaLevel}
          </div>
        </div>
        
        {/* Детали статистики */}
        <div className="cf-stats-grid">
          <div className="cf-stat-card">
            <div className="cf-stat-value">{details.totalSolved}</div>
            <div className="cf-stat-label">Решено задач</div>
          </div>
          <div className="cf-stat-card">
            <div className="cf-stat-value">{details.averageRating}</div>
            <div className="cf-stat-label">Средний рейтинг</div>
          </div>
          <div className="cf-stat-card">
            <div className="cf-stat-value">{details.uniqueTags}</div>
            <div className="cf-stat-label">Уникальных тегов</div>
          </div>
        </div>
        
        {/* Распределение по сложности */}
        <div className="cf-section">
          <h3 className="cf-section-title">Распределение по сложности</h3>
          <div className="cf-difficulty-chart">
            <div className="cf-difficulty-bar">
              <div 
                className="cf-difficulty-segment cf-easy"
                style={{ 
                  width: `${(difficultyDistribution.easy / Math.max(details.totalSolved, 1)) * 100}%` 
                }}
                title={`Легкие: ${difficultyDistribution.easy}`}
              />
              <div 
                className="cf-difficulty-segment cf-medium"
                style={{ 
                  width: `${(difficultyDistribution.medium / Math.max(details.totalSolved, 1)) * 100}%` 
                }}
                title={`Средние: ${difficultyDistribution.medium}`}
              />
              <div 
                className="cf-difficulty-segment cf-hard"
                style={{ 
                  width: `${(difficultyDistribution.hard / Math.max(details.totalSolved, 1)) * 100}%` 
                }}
                title={`Сложные: ${difficultyDistribution.hard}`}
              />
            </div>
            <div className="cf-difficulty-legend">
              <span className="cf-legend-item cf-easy">
                Легкие ({difficultyDistribution.easy})
              </span>
              <span className="cf-legend-item cf-medium">
                Средние ({difficultyDistribution.medium})
              </span>
              <span className="cf-legend-item cf-hard">
                Сложные ({difficultyDistribution.hard})
              </span>
            </div>
          </div>
        </div>
        
        {/* breakdown кармы */}
        <div className="cf-section">
          <h3 className="cf-section-title">Разбивка кармы</h3>
          <div className="cf-karma-breakdown">
            <div className="cf-breakdown-row">
              <span>Легкие задачи:</span>
              <span style={{ color: '#28a745' }}>+{breakdown.easyKarma}</span>
            </div>
            <div className="cf-breakdown-row">
              <span>Средние задачи:</span>
              <span style={{ color: '#007bff' }}>+{breakdown.mediumKarma}</span>
            </div>
            <div className="cf-breakdown-row">
              <span>Сложные задачи:</span>
              <span style={{ color: '#dc3545' }}>+{breakdown.hardKarma}</span>
            </div>
            <div className="cf-breakdown-row">
              <span>Бонус за теги:</span>
              <span style={{ color: '#ffc107' }}>+{breakdown.tagBonusKarma}</span>
            </div>
            <div className="cf-breakdown-row">
              <span>Бонус за разнообразие:</span>
              <span style={{ color: '#6f42c1' }}>+{breakdown.diversityBonus}</span>
            </div>
            <div className="cf-breakdown-row cf-total">
              <span>Итого:</span>
              <span style={{ color: karmaColor }}>{karma}</span>
            </div>
          </div>
        </div>
        
        {/* Топ тегов */}
        {tagStats.length > 0 && (
          <div className="cf-section">
            <h3 className="cf-section-title">Топ тегов</h3>
            <div className="cf-tags-chart">
              {tagStats.slice(0, 10).map((tagStat, index) => (
                <div key={index} className="cf-tag-row">
                  <div className="cf-tag-name">{tagStat.tag}</div>
                  <div className="cf-tag-bar-container">
                    <div 
                      className="cf-tag-bar"
                      style={{ 
                        width: `${(tagStat.solvedCount / maxTagCount) * 100}%`,
                        backgroundColor: karmaColor
                      }}
                    />
                  </div>
                  <div className="cf-tag-count">
                    {tagStat.solvedCount} {tagStat.averageRating > 0 && `(avg ${tagStat.averageRating})`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeforcesStats;
