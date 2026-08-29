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
