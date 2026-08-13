import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SkipLink } from '@/components/layout/SkipLink';
import { locales } from '@/lib/i18n/locales';
import { routing } from '@/lib/i18n/routing';
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

  // The `[locale]` segment also catches unknown paths, so an unsupported value
  // must 404 rather than fall back to the default language.
  if (!hasLocale(routing.locales, locale)) notFound();

  // Opts this route into static rendering; without it next-intl forces the
  // page to render dynamically.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        There is no NextIntlClientProvider here. Server components read
        translations from the request config directly, and the provider
        serialises the entire message catalogue into the HTML for the client.
        On the marketing pages that meant shipping the full legal text to
        every visitor who never opened it. The provider lives in `(app)`,
        where client components actually exist.
      */}
      <body className="flex min-h-full flex-col">
        <SkipLink />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
