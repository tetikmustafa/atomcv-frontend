import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Applications } from '@/components/applications/Applications';
import { routing } from '@/lib/i18n/routing';

/**
 * § 36.1's `applications/`, landed with `B-093`.
 *
 * A route of its own rather than a panel on the history: the history answers
 * "which resume did I make", and this answers "where did I send one and what
 * happened". They share a row at most.
 */
export default async function ApplicationsPage({ params }: PageProps<'/[locale]/applications'>) {
  const { locale } = await params;

  // Not only in the parent layout: Next renders layouts and pages in
  // parallel, so a page that leaves this out is marked dynamic no matter what
  // the layout did.
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Applications' });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-12">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <Applications />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/applications'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Applications' });
  return { title: t('title') };
}
