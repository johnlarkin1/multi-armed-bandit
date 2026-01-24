import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flaky Load Balancer Dashboard',
  description: 'Multi-Armed Bandit Load Balancer metrics dashboard',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
