import Image from 'next/image';

import type { UserData } from '../types';

interface ProfileSummaryCardProps {
  userData: UserData;
  onToggleEdit: () => void;
  onSignOut: () => void;
  onOpenKarmaDetails: () => void;
  isKarmaDetailsDisabled?: boolean;
  karmaDetailsTitle?: string;
}

export default function ProfileSummaryCard({
  userData,
  onToggleEdit,
  onSignOut,
  onOpenKarmaDetails,
  isKarmaDetailsDisabled = false,
  karmaDetailsTitle = 'Открыть статистику кармы',
}: ProfileSummaryCardProps) {
  const rawKarma = Number(userData.codeforces_karma ?? 0);
  const codeforcesKarma = Number.isFinite(rawKarma) ? rawKarma : 0;
  const rawRating = Number(userData.bscp_rating ?? 0);
  const bscpRating = Number.isFinite(rawRating) ? rawRating : 0;

  return (
    <div className="profile-card">
      <div className="profile-card__name">
        {userData.full_name || 'Неизвестный пользователь'}
      </div>
      <div className="profile-card__metrics">
        <div
          className="profile-card__metric"
          aria-label={`Рейтинг: ${bscpRating}`}
          title="Рейтинг"
        >
          <Image
            className="profile-card__star"
            src="/profile-assets/star.svg"
            alt=""
            width={30}
            height={30}
            aria-hidden="true"
          />
          <span className="profile-card__rating-value">{bscpRating}</span>
        </div>
        <button
          type="button"
          className="profile-card__metric profile-card__metric--button"
          aria-label={`Карма: ${codeforcesKarma}`}
          title={karmaDetailsTitle}
          disabled={isKarmaDetailsDisabled}
          onClick={onOpenKarmaDetails}
        >
          <span className="profile-card__karma-icon" aria-hidden="true">
            <Image
              className="profile-card__karma-image"
              src="/profile-assets/karma.png"
              alt=""
              width={78}
              height={34}
            />
          </span>
          <span className="profile-card__rating-value">{codeforcesKarma}</span>
        </button>
      </div>

      <a
        className="profile-card__field profile-card__email"
        href={`mailto:${userData.email}`}
        target="_blank"
        rel="noreferrer"
      >
        {userData.email}
      </a>
      <div className="profile-card__field profile-card__phone">
        {userData.phone || '—'}
      </div>

      <div className="profile-card__actions">
        <button
          type="button"
          className="profile-card__btn profile-card__btn--edit"
          onClick={onToggleEdit}
        >
          Редактировать
        </button>
        <button
          type="button"
          className="profile-card__btn profile-card__btn--logout"
          onClick={onSignOut}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
