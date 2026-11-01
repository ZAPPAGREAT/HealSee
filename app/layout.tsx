import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HEalSee',
  description: '毎日の摂取・消費カロリーを記録し、週間・累計収支を管理するツール',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
