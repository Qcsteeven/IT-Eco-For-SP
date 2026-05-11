import Image from 'next/image';

import type { UserData } from '../types';

interface ProfileSummaryCardProps {
  userData: UserData;
  onToggleEdit: () => void;
  onSignOut: () => void;
}

export default function ProfileSummaryCard({
  userData,
  onToggleEdit,
  onSignOut,
}: ProfileSummaryCardProps) {
  return (
    <div className="profile-card">
      <div className="profile-card__name">
        {userData.full_name || 'Неизвестный пользователь'}
      </div>
      <div className="profile-card__rating">
        <Image
          className="profile-card__star"
          src="/profile-assets/star.svg"
          alt=""
          width={30}
          height={30}
          aria-hidden="true"
        />
        <span className="profile-card__rating-value">{userData.bscp_rating}</span>
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
