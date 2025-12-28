'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/providers/theme-provider';
import { MainLayout } from '@/components/layout/main-layout';
import { TimelineProvider } from '@/contexts/TimelineContext';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Digital Media Editor</title>
        <meta name="description" content="Professional media editing platform" />
      </head>
      <body className={inter.className +' overflow-y-hidden'}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <TimelineProvider>
            <MainLayout>{children}</MainLayout>
          </TimelineProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}