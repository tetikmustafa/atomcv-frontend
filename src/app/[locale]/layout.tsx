import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { isLocale, locales } from '@/lib/i18n/locales';
import '@/styles/globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'latin-ext'],
});

export const metadata: Metadata = {
  title: 'AtomCV',
  description: 'Build your profile once, generate a tailored resume for every job posting.',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * This is the root layout. Every route lives under `[locale]`, so the `<html>`
 * element is rendered here with the requested language (Next.js allows the root
 * layout to be nested inside a dynamic segment).
 */
export default async function RootLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;

  if (!isLocale(locale)) notFound();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
