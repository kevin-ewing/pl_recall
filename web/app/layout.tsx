import type { Metadata } from 'next';
import './globals.css';
import './mobile.css';
import './motion.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const siteUrl = 'https://kevin-ewing.github.io/pl_recall';

export const metadata: Metadata = {
  title: 'Player Lab — Premier League Flashcards',
  description: 'A face-first Premier League player flashcard study deck.',
  metadataBase: new URL(siteUrl),
  icons: { icon: `${basePath}/favicon.svg` },
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: 'Player Lab — Premier League Flashcards',
    description: 'Learn every Premier League player, face first.',
    images: [{ url: `${siteUrl}/social-preview.png`, width: 1200, height: 630, alt: 'Player Lab Premier League Flashcards' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Player Lab — Premier League Flashcards',
    description: 'Learn every Premier League player, face first.',
    images: [`${siteUrl}/social-preview.png`],
  },
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
