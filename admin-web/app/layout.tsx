import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '가는길에 관리자',
  description: '가는길에 백오피스 관리 시스템',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
