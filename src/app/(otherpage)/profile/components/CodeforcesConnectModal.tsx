import type { FormEvent } from 'react';

import type { VerificationStep } from '../types';

interface CodeforcesConnectModalProps {
  step: VerificationStep;
  input: string;
  loading: boolean;
  error: string | null;
  generatedCode: string;
  autoVerifyCountdown: number;
  onInputChange: (value: string) => void;
  onClose: () => void;
  onConnect: (event: FormEvent<HTMLFormElement>) => void;
  onVerify: () => void;
  onResetCode: () => void;
  onStartVerify: () => void;
}

export default function CodeforcesConnectModal({
  step,
  input,
  loading,
  error,
  generatedCode,
  autoVerifyCountdown,
  onInputChange,
  onClose,
  onConnect,
  onVerify,
  onResetCode,
  onStartVerify,
}: CodeforcesConnectModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {step === 'input_username' ? (
          <>
            <h2>Привязка аккаунта Codeforces</h2>
            <p>Введите ваш хендл на Codeforces:</p>
            <form onSubmit={onConnect}>
              <input
                type="text"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Например: tourist"
                disabled={loading}
                autoFocus
              />
              {error && <p className="error-message">{error}</p>}
              <div className="modal-buttons">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="btn-cancel"
                >
                  Отмена
                </button>
                <button type="submit" disabled={loading} className="btn-submit">
                  {loading ? 'Проверка...' : 'Далее'}
                </button>
              </div>
            </form>
          </>
        ) : step === 'show_code' ? (
          <>
            <h2>Код верификации</h2>
            <div className="verification-code-display">
              <p>
                <strong>Сохраните этот код!</strong>
              </p>
              <p>
                Разместите его в вашем <strong>профиле на Codeforces</strong> в
                поле <strong>First Name</strong>:
              </p>
              <ol className="affiliation-steps">
                <li>
                  Перейдите на{' '}
                  <a
                    href="https://codeforces.com/settings/social"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Codeforces Settings
                  </a>
                </li>
                <li>
                  Найдите поле <strong>First Name</strong> (Имя)
                </li>
                <li>Вставьте туда этот код (см. ниже)</li>
                <li>
                  Нажмите <strong>Save Changes</strong> для сохранения
                </li>
                <li>Вернитесь сюда и нажмите &laquo;Проверить&raquo;</li>
              </ol>
              <div className="code-box">{generatedCode}</div>
              <p className="code-warning">
                💡 Если вы забыли код — нажмите кнопку ниже для генерации нового
              </p>
            </div>
            <div className="modal-buttons">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn-cancel"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onResetCode}
                disabled={loading}
                className="btn-secondary"
                style={{
                  backgroundColor: '#f59e0b',
                  color: '#fff',
                  marginRight: '10px',
                }}
              >
                Новый код
              </button>
              <button
                type="button"
                onClick={onStartVerify}
                disabled={loading}
                className="btn-submit"
              >
                Я разместил код в First Name
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Проверка привязки</h2>
            <p className="verification-instructions">
              Автоматическая проверка через{' '}
              <strong>{autoVerifyCountdown} сек...</strong>
            </p>
            <p className="verification-hint">
              Убедитесь, что код размещён в поле <strong>First Name</strong> на
              Codeforces
            </p>
            <div className="checking-status">
              <div className="spinner"></div>
              <p>
                Проверка профиля <strong>{input}</strong>...
              </p>
            </div>
            {error && <p className="error-message">{error}</p>}
            <div className="modal-buttons">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn-cancel"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onVerify}
                disabled={loading || autoVerifyCountdown > 0}
                className="btn-submit"
              >
                {loading
                  ? 'Проверка...'
                  : autoVerifyCountdown > 0
                    ? `Проверить (${autoVerifyCountdown})`
                    : 'Проверить сейчас'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
