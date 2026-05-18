import type { MouseEvent } from 'react';

import type { AtCoderData, CFData } from '../types';

interface AtCoderStatsSectionProps {
  data: AtCoderData;
  onDisconnect: (event: MouseEvent) => void;
}

interface CodeforcesStatsSectionProps {
  data: CFData;
  onDisconnect: (event: MouseEvent) => void;
}

function RatingChange({ value }: { value: number }) {
  return (
    <td className={value >= 0 ? 'status-ac' : 'rating-change negative'}>
      {value >= 0 ? '+' : ''}
      {value}
    </td>
  );
}

export function AtCoderStatsSection({
  data,
  onDisconnect,
}: AtCoderStatsSectionProps) {
  return (
    <div className="atcoder-section">
      <div className="atcoder-header">
        <h2>Данные AtCoder: {data.atcoder_username}</h2>
        <button
          onClick={onDisconnect}
          className="btn-disconnect"
          title="Отвязать аккаунт"
        >
          Отвязать
        </button>
      </div>

      {data.user_info && (
        <div className="atcoder-stats">
          <div className="stat-item">
            <span className="stat-label">Рейтинг:</span>
            <span className="stat-value">{data.user_info.rating}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Ранг:</span>
            <span className="stat-value">{data.user_info.rank || 'N/A'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Участий в контестах:</span>
            <span className="stat-value">
              {data.user_info.attended_contests_count}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Сумма очков:</span>
            <span className="stat-value">{data.user_info.rated_point_sum}</span>
          </div>
        </div>
      )}

      <h3>История участия в контестах</h3>
      {data.submissions && data.submissions.length > 0 ? (
        <table className="atcoder-submissions">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Контест</th>
              <th>Место</th>
              <th>Рейтинг до</th>
              <th>Рейтинг после</th>
              <th>Изменение</th>
            </tr>
          </thead>
          <tbody>
            {data.submissions
              .slice()
              .reverse()
              .map((sub) => (
                <tr key={sub.contest_id + sub.contest_end_time}>
                  <td>
                    {sub.contest_end_time
                      ? new Date(sub.contest_end_time).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td>{sub.contest_name}</td>
                  <td>{sub.user_rank || 'N/A'}</td>
                  <td>{sub.user_old_rating || 'N/A'}</td>
                  <td>{sub.user_new_rating || 'N/A'}</td>
                  <RatingChange value={sub.user_rating_change} />
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p>Нет данных об участии в контестах или данные загружаются...</p>
      )}
    </div>
  );
}

export function CodeforcesStatsSection({
  data,
  onDisconnect,
}: CodeforcesStatsSectionProps) {
  return (
    <div className="atcoder-section">
      <div className="atcoder-header">
        <h2>Данные Codeforces: {data.cf_username}</h2>
        <button
          onClick={onDisconnect}
          className="btn-disconnect"
          title="Отвязать аккаунт"
        >
          Отвязать
        </button>
      </div>

      {data.user_info && (
        <div className="atcoder-stats">
          <div className="stat-item">
            <span className="stat-label">Рейтинг:</span>
            <span className="stat-value">{data.user_info.rating}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Ранг:</span>
            <span className="stat-value">{data.user_info.rank || 'N/A'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Макс. рейтинг:</span>
            <span className="stat-value">
              {data.user_info.max_rating || 'N/A'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Участий в контестах:</span>
            <span className="stat-value">
              {data.user_info.attended_contests_count}
            </span>
          </div>
        </div>
      )}

      <h3>История участия в контестах</h3>
      {data.submissions && data.submissions.length > 0 ? (
        <table className="atcoder-submissions">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Контест</th>
              <th>Место</th>
              <th>Рейтинг до</th>
              <th>Рейтинг после</th>
              <th>Изменение</th>
            </tr>
          </thead>
          <tbody>
            {data.submissions
              .slice()
              .reverse()
              .map((sub) => (
                <tr key={sub.contest_id + sub.contest_end_time}>
                  <td>
                    {sub.contest_end_time
                      ? new Date(sub.contest_end_time).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td>{sub.contest_name}</td>
                  <td>{sub.user_rank || 'N/A'}</td>
                  <td>{sub.user_old_rating || 'N/A'}</td>
                  <td>{sub.user_new_rating || 'N/A'}</td>
                  <RatingChange value={sub.user_rating_change} />
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p>Нет данных об участии в контестах или данные загружаются...</p>
      )}
    </div>
  );
}
