import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flaky Load Balancer Dashboard',
  description: 'Multi-Armed Bandit Load Balancer metrics dashboard',
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
