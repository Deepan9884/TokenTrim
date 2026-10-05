import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TokenTrim Creator Panel',
  description: 'User trends, accounts, and event analytics for TokenTrim.',
  icons: {
    icon: '/icon32.png',
    apple: '/icon128.png'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
