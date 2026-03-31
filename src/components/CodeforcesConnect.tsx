'use client';

import React, { useState } from 'react';

interface CodeforcesConnectProps {
  userId: string;
  onVerified: (handle: string) => void;
}

type Step = 'initial' | 'verifying' | 'success' | 'error';

const CodeforcesConnect: React.FC<CodeforcesConnectProps> = ({
  userId,
  onVerified,
}) => {
  const [handle, setHandle] = useState<string>('');
  const [step, setStep] = useState<Step>('initial');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  /**
   * Инициализирует процесс подключения, отправляя хендл и получая код верификации.
   */
  const handleInit = async () => {
    setLoading(true);
    setMessage('');

    if (!handle.trim()) {
      setMessage('Пожалуйста, введите хендл Codeforces.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/codeforces/init-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim(), userId }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setVerificationCode(data.code);
        setStep('verifying');
        setMessage('');
      } else {
        setMessage(data.error || 'Ошибка при создании запроса на верификацию.');
        setStep('error');
      }
    } catch {
      setMessage('Ошибка сети при инициализации.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Проверяет, был ли код верификации добавлен в профиль Codeforces.
   */
  const handleVerify = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/codeforces/verify-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setStep('success');
        setMessage(data.message);
        onVerified(handle);
      } else {
        const errorMessage =
          data.message ||
          data.error ||
          'Не удалось подтвердить. Проверьте, что код сохранен в поле "Имя" (First Name) и профиль Codeforces обновлен.';

        setMessage(errorMessage);
        setStep('verifying');
      }
    } catch {
      setMessage('Ошибка сети при проверке.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Сбрасывает состояние для начала нового подключения.
   */
  const resetState = () => {
    setHandle('');
    setVerificationCode('');
    setMessage('');
    setStep('initial');
  };

  /**
   * Рендеринг контента в зависимости от текущего шага.
   */
  const renderContent = () => {
    switch (step) {
      case 'initial':
        return (
          <div className="flex flex-col gap-3 text-black">
            <label className="text-sm font-medium">
              Введите ваш хендл (никнейм) Codeforces:
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="border p-2 rounded focus:ring-blue-500 focus:border-blue-500 text-black"
              placeholder="tourist"
              disabled={loading}
            />
            <button
              onClick={handleInit}
              disabled={!handle.trim() || loading}
              className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Инициализация...' : 'Начать подключение'}
            </button>
            {message && <p className="text-red-500 text-sm mt-1">{message}</p>}
          </div>
        );

      case 'verifying':
        return (
          <div className="flex flex-col gap-4 text-black">
            {/* ИСПРАВЛЕНИЕ: Отображаем сообщение об ошибке, если оно есть */}
            {message && (
              <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded text-sm font-medium">
                🚨 Ошибка проверки: {message}
              </div>
            )}

            <div className="bg-yellow-100 p-3 border-l-4 border-yellow-500 text-sm">
              <p className="mb-2 font-bold">
                Шаги для подтверждения аккаунта ({handle}):
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Перейдите в настройки профиля Codeforces.</li>
                <li>
                  Вставьте код ниже в поле <b>Имя (First Name)</b>.
                </li>
                <li>Обязательно сохраните изменения.</li>
                <li>Нажмите «Проверить» ниже.</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 bg-gray-200 p-3 rounded font-mono text-lg justify-between border text-black">
              <span className="break-all">{verificationCode}</span>
              <button
                onClick={() => navigator.clipboard.writeText(verificationCode)}
                className="text-xs text-blue-700 hover:underline flex-shrink-0 ml-2"
              >
                Копировать
              </button>
            </div>

            <button
              onClick={handleVerify}
              disabled={loading}
              className="bg-green-600 text-white p-2 rounded hover:bg-green-700 transition disabled:opacity-50"
            >
              {loading ? 'Проверка...' : 'Я сохранил, Проверить'}
            </button>

            <button
              onClick={resetState}
              className="text-sm text-black underline"
            >
              Отмена / Ввести другой хендл
            </button>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-6 bg-green-100 rounded-lg text-black">
            <div className="text-5xl mb-2">🎉</div>
            <h3 className="text-xl font-bold text-green-800">
              Аккаунт подтвержден!
            </h3>
            <p className="mt-2">{message}</p>
            <button
              onClick={resetState}
              className="mt-4 text-blue-700 underline"
            >
              Готово
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-6 bg-red-100 rounded-lg text-black">
            <div className="text-5xl mb-2">❌</div>
            <h3 className="text-xl font-bold text-red-800">Ошибка</h3>
            <p className="mt-2">{message}</p>
            <button
              onClick={resetState}
              className="mt-4 text-blue-700 underline"
            >
              Начать заново
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 border rounded-xl shadow-lg max-w-lg mx-auto bg-white text-black">
      <h2 className="text-2xl font-extrabold mb-4 border-b pb-2">
        Подключение Codeforces
      </h2>
      {renderContent()}
    </div>
  );
};

export default CodeforcesConnect;
