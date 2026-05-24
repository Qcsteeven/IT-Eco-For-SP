import Image from 'next/image';
import type { MouseEvent } from 'react';

import type { AtCoderData, CFData } from '../types';

interface ExternalSystemsCardProps {
  cfData: CFData | null;
  atCoderData: AtCoderData | null;
  onCFClick: (event: MouseEvent) => void;
  onAtCoderClick: (event: MouseEvent) => void;
}

export default function ExternalSystemsCard({
  cfData,
  atCoderData,
  onCFClick,
  onAtCoderClick,
}: ExternalSystemsCardProps) {
  return (
    <div className="profile-systems-card">
      <div className="profile-systems-card__title">Вход во внешние системы</div>
      <div className="profile-systems-grid">
        {cfData?.connected ? (
          <button
            onClick={onCFClick}
            className="profile-system-btn profile-system-btn--codeforces-connected"
            title="Нажмите, чтобы посмотреть историю или отвязать"
          >
            <span className="profile-system-btn__text">
              Подключено
              <br />
              Codeforces
            </span>
            <Image
              className="profile-system-btn__logo profile-system-btn__logo--codeforces"
              src="/profile-assets/codeforces.png"
              alt=""
              width={96}
              height={96}
              aria-hidden="true"
            />
          </button>
        ) : cfData?.pending_verification ? (
          <button
            onClick={onCFClick}
            className="profile-system-btn profile-system-btn--pending"
            style={{
              backgroundColor: '#ffc107',
              color: '#333',
              border: '1px solid #e0a800',
            }}
            title="Нажмите, чтобы завершить верификацию"
          >
            Подключить Codeforces
          </button>
        ) : (
          <button
            onClick={onCFClick}
            className="profile-system-btn"
            title="Нажмите, чтобы привязать"
          >
            <span className="profile-system-btn__text">
              Подключить
              <br />
              Codeforces
            </span>
            <Image
              className="profile-system-btn__logo profile-system-btn__logo--codeforces"
              src="/profile-assets/codeforces.png"
              alt=""
              width={96}
              height={96}
              aria-hidden="true"
            />
          </button>
        )}

        {atCoderData?.connected ? (
          <button
            onClick={onAtCoderClick}
            className="profile-system-btn profile-system-btn--atcoder-connected"
            title="Нажмите, чтобы отвязать или посмотреть submissions"
          >
            <span className="profile-system-btn__text">
              Подключено
              <br />
              AtCoder
            </span>
            <Image
              className="profile-system-btn__logo profile-system-btn__logo--atcoder"
              src="/profile-assets/atcoder.png"
              alt=""
              width={96}
              height={96}
              aria-hidden="true"
            />
          </button>
        ) : atCoderData?.pending_verification ? (
          <button
            onClick={onAtCoderClick}
            className="profile-system-btn profile-system-btn--pending"
            style={{
              backgroundColor: '#ffc107',
              color: '#333',
              border: '1px solid #e0a800',
            }}
            title="Нажмите, чтобы завершить верификацию"
          >
            Подключить AtCoder
          </button>
        ) : (
          <button
            onClick={onAtCoderClick}
            className="profile-system-btn"
            title="Нажмите, чтобы привязать"
          >
            <span className="profile-system-btn__text">
              Подключить
              <br />
              AtCoder
            </span>
            <Image
              className="profile-system-btn__logo profile-system-btn__logo--atcoder"
              src="/profile-assets/atcoder.png"
              alt=""
              width={96}
              height={96}
              aria-hidden="true"
            />
          </button>
        )}

        <a
          href="https://leetcode.com/accounts/login/"
          target="_blank"
          rel="noopener noreferrer"
          className="profile-system-btn"
        >
          <span className="profile-system-btn__text">
            Подключить
            <br />
            LeetCode
          </span>
          <Image
            className="profile-system-btn__logo profile-system-btn__logo--leetcode"
            src="/profile-assets/leetcode.png"
            alt=""
            width={96}
            height={96}
            aria-hidden="true"
          />
        </a>
      </div>
    </div>
  );
}
