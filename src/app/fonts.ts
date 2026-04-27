import { Montserrat } from 'next/font/google';
import localFont from 'next/font/local';

export const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const chetty = localFont({
  src: '../../public/fonts/CHETTY.woff2',
  variable: '--font-chetty',
  display: 'swap',
});

export const stengazeta = localFont({
  src: '../../public/fonts/Stengazeta.woff2',
  variable: '--font-stengazeta',
  display: 'swap',
});

