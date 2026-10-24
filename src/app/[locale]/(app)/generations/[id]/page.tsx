import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Page } from '@/components/layout/Page';
import { GenerationResult } from '@/components/generation/GenerationResult';
import { routing } from '@/lib/i18n/routing';

/**
 * A finished generation, addressable by URL.
 *
 * It has to be: the progress screen replaces itself with this one, and a
 * reload has to land somewhere real rather than on a bar that will never
 * move again. What it can show on a cold load is limited by what the API
 * publishes — see the component (`F-008`).
 */
export default async function GenerationPage({ params }: PageProps<'/[locale]/generations/[id]'>) {
  const { locale, id } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // The heading is the result's own: it names the role the posting was for
  // (`B-124`), which only the client-side read knows.
  return (
    <Page>
      <GenerationResult generationId={id} />
    </Page>
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/generations/[id]'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Result' });
  return { title: t('title') };
}
