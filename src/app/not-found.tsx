import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center px-4">
        <h1 className="text-9xl font-bold text-indigo-600">404</h1>
        <h2 className="text-3xl font-semibold text-gray-800 mt-4 mb-2">
          Страница не найдена
        </h2>
        <p className="text-gray-600 mb-8 max-w-md">
          К сожалению, страница, которую вы ищете, не существует или была перемещена.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200"
        >
          Вернуться на главную
        </Link>
      </div>
    </div>
  );
}
