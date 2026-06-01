import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import './globals.css';

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Deployment OS — Command Center',
  description: 'Autonomous GTM signal-routing engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistMono.variable} font-mono bg-surface-900 text-zinc-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
