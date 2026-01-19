import './null.scss';
import './basic.scss';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function OtherPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Добавляем flex-контейнер на всю высоту экрана
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
      <Header />
      {/* main будет занимать все свободное место */}
      <main
        style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
