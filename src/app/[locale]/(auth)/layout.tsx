import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { AppProviders } from '@/components/providers/AppProviders';
import { routing } from '@/lib/i18n/routing';

/**
 * The sign-in surface: the same providers as the app, none of its chrome.
 *
 * It needs the providers because every screen under here talks to the API —
 * the provider list, the session read that makes the cookie visible
 * (§ 40.6.1) — and it must not have the app shell, because the nav offers
 * places to go and these three pages are each in the middle of something.
 * `/auth/complete` in particular is a redirect that paused to say one
 * sentence.
 *
 * `<main id="main">` is here rather than in the shell for the same reason:
 * the skip link lives in the root layout and every page it can reach needs a
 * target, including the ones outside `(app)`.
 */
/**
 * Nothing under here is for a crawler, and `robots.txt` alone does not say
 * so: it asks a crawler not to **fetch** the page, which leaves a URL somebody
 * linked to eligible to be listed from the link alone. The header says not to
 * **index** what was fetched anyway, and the two together are what keep one
 * person's profile out of a result page.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <AppProviders>
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
      </AppProviders>
    </NextIntlClientProvider>
  );
}
