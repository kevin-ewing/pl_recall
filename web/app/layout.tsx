import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Player Lab — Premier League Flashcards',
  description: 'A face-first Premier League player flashcard study deck.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
