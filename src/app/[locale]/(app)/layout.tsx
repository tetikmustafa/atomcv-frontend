import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { AppProviders } from '@/components/providers/AppProviders';
import { routing } from '@/lib/i18n/routing';

/**
 * Shell for the authenticated application.
 *
 * Providers live here rather than in the root layout on purpose. The landing
 * and legal pages are static marketing surface that fetches nothing, and
 * every kilobyte the app shell adds would otherwise be paid on first contact
 * with the product — the moment where the anonymous funnel is thinnest
 * (Bölüm 12). Keeping them apart also stops the mock worker's startup gate
 * from blanking the landing page in development.
 *
 * `NextIntlClientProvider` is one of those providers: it serialises the
 * message catalogue into the HTML so client components can read it, which
 * only pays for itself where client components exist.
 *
 * The auth guard belongs here too, once sessions exist.
 */
export default async function AppLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <AppProviders>
        <AppShell>{children}</AppShell>
      </AppProviders>
    </NextIntlClientProvider>
  );
}
