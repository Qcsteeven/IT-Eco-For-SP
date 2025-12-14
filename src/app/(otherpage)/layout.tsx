import './null.scss';
import './basic.scss';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';


export default function OtherPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Header></Header>
      <main>{children}</main>
      <Footer></Footer>
    </div>
  )
}
