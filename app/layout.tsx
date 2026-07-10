import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import { Toaster } from '@/components/Toast';
import './globals.css';

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Long Sơn Homestay',
  description: 'Quản lý đặt phòng homestay Long Sơn',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#16202e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${jetbrains.variable}`}>
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
