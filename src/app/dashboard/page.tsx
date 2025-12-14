'use client';

import CodeforcesConnect from '@/components/CodeforcesConnect';

/**
 * Главный компонент страницы /dashboard.
 * Next.js App Router автоматически сопоставляет этот файл с маршрутом /dashboard.
 */
export default function DashboardPage() {
  const currentUserId = 'users:clx4c6a6s0000j59n8f4k8a9q';

  const handleVerificationSuccess = (handle: string) => {
    console.log(
      `[DASHBOARD] Аккаунт Codeforces '${handle}' успешно верифицирован.`,
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">
        Панель управления и интеграции
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 1. Общий Dashboard (Server Component) */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Обзор профиля</h2>
          <p>Добро пожаловать, {currentUserId}.</p>
          <p className="mt-4 text-gray-600">
            Здесь может находиться статическая информация, загруженная на
            сервере.
          </p>
        </div>

        {/* 2. Компонент подключения Codeforces (Client Component) */}
        {/* Компонент CodeforcesConnect использует 'use client' и интерактивность */}
        <CodeforcesConnect
          userId={currentUserId}
          onVerified={handleVerificationSuccess}
        />
      </div>
    </div>
  );
}
