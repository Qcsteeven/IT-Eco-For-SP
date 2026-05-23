import type { FormEvent } from 'react';

import type { VerificationStep } from '../types';

interface AtCoderConnectModalProps {
  step: VerificationStep;
  input: string;
  loading: boolean;
  error: string | null;
  generatedCode: string;
  onInputChange: (value: string) => void;
  onClose: () => void;
  onConnect: (event: FormEvent<HTMLFormElement>) => void;
  onVerify: () => void;
  onResetCode: () => void;
  onStartVerify: () => void;
}

export default function AtCoderConnectModal({
  step,
  input,
  loading,
  error,
  generatedCode,
  onInputChange,
  onClose,
  onConnect,
  onVerify,
  onResetCode,
  onStartVerify,
}: AtCoderConnectModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {step === 'input_username' ? (
          <>
            <h2>Привязка аккаунта AtCoder</h2>
            <p>Введите ваше имя пользователя на AtCoder:</p>
            <form onSubmit={onConnect}>
              <input
                type="text"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Например: user123"
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
                Разместите его в вашем <strong>профиле на AtCoder</strong> в
                поле <strong>Affiliation</strong>:
              </p>
              <ol className="affiliation-steps">
                <li>
                  Перейдите на{' '}
                  <a
                    href="https://atcoder.jp/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    AtCoder Settings
                  </a>
                </li>
                <li>
                  Найдите поле <strong>Affiliation</strong> (Организация/Компания)
                </li>
                <li>Вставьте туда этот код (см. ниже)</li>
                <li>
                  Нажмите <strong>Update</strong> для сохранения
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
                Я разместил код в Affiliation
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Проверка привязки</h2>
            <p className="verification-instructions">
              Проверяем, что код размещён в поле <strong>Affiliation</strong> на
              AtCoder...
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
                disabled={loading}
                className="btn-submit"
              >
                {loading ? 'Проверка...' : 'Проверить'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
