import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';

/**
 * Landing page (SSG). Real content and layout land in a later step; this
 * verifies that the locale reaches the message catalogue.
 */
export default async function LandingPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;

  // Repeated from the layout because `params.locale` is typed as `string`;
  // the guard is what narrows it to a supported locale.
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  const t = await getTranslations('Landing');

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-4 p-8 outline-none"
    >
      <h1 className="text-3xl font-semibold">AtomCV</h1>
      <p className="text-base">{t('tagline')}</p>
    </main>
  );
}
