import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SkipLink } from '@/components/layout/SkipLink';
import { locales } from '@/lib/i18n/locales';
import { routing } from '@/lib/i18n/routing';
import { SITE_URL } from '@/lib/seo';
import { THEME_SCRIPT } from '@/lib/theme';
import '@/styles/globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'latin-ext'],
});

/**
 * What every page inherits.
 *
 * `metadataBase` is what turns the relative URLs below into absolute ones;
 * without it Next resolves them against localhost and says so in the build
 * log, which is easy to read past. The origin comes from the deployment
 * (`src/lib/seo.ts`).
 *
 * The title is a **template**, so a page states its own name and the product
 * is appended once. Before this each page that wanted the suffix wrote it
 * out, which is two places for one decision — and the legal pages were the
 * only two that had remembered.
 *
 * No `openGraph.images`: an image nobody has drawn is a 404 in every preview
 * card, and a generated one is a design decision rather than a metadata one.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AtomCV',
    template: '%s — AtomCV',
  },
  openGraph: {
    siteName: 'AtomCV',
    type: 'website',
  },
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
      /*
        The head script below writes `class` and `style` on this element
        before React sees it, so the server's markup and the client's first
        pass disagree by design. Without this, React logs a hydration warning
        about the one attribute it is supposed to find changed.
      */
      suppressHydrationWarning
    >
      <head>
        {/*
          Blocking, inline, and before anything paints (`src/lib/theme.ts`).
          A theme applied from React paints the light palette first and then
          corrects itself — a white flash in a dark room, which is the reason
          this task was held back rather than half-done.

          `dangerouslySetInnerHTML` is the only way to emit a script body in
          JSX, and the content is a module constant with no interpolation of
          anything a user can reach.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
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
