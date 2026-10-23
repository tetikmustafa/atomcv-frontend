import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';

/**
 * Every path under a locale that no route claims.
 *
 * Only the application root's `not-found` answers an unmatched URL, and this
 * application's root layout is `[locale]` — so without this, `/tr/nothing`
 * fell through to Next's bare default in English. Calling `notFound()` here
 * hands it to `[locale]/not-found.tsx`, inside the locale's own layout.
 *
 * The locale is set first, as on every page: the 404 it hands to is
 * translated, and it should be translated into the language of the URL.
 */
export default async function CatchAll({ params }: PageProps<'/[locale]/[...rest]'>) {
  const { locale } = await params;

  if (hasLocale(routing.locales, locale)) setRequestLocale(locale);
  notFound();
}
