import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* О проекте */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">IT-Eco-For-SP</h3>
            <p className="text-sm text-gray-400">
              Образовательная экосистема для студентов с ИИ-ассистентом, 
              интеграцией с Codeforces и AtCoder, и системой рейтингов.
            </p>
          </div>

          {/* Навигация */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Навигация</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Главная
                </Link>
              </li>
              <li>
                <Link href="/chat" className="hover:text-white transition-colors">
                  ИИ-ассистент
                </Link>
              </li>
              <li>
                <Link href="/profile" className="hover:text-white transition-colors">
                  Профиль
                </Link>
              </li>
              <li>
                <Link href="/calendar" className="hover:text-white transition-colors">
                  Календарь соревнований
                </Link>
              </li>
            </ul>
          </div>

          {/* Контакты */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Контакты</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Email: support@it-eco-for-sp.ru</li>
              <li>GitHub: @Qcsteeven</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-sm text-gray-500">
          <p>&copy; {currentYear} IT-Eco-For-SP. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}