import type { Metadata } from 'next';
import './index.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Stobee - AI 동화 생성기',
  description: '아이를 위한 맞춤형 애니메이션 동화를 만들어보세요',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
