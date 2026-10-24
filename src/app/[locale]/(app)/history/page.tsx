import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { History } from '@/components/generation/History';
import { Page, PageHeader } from '@/components/layout/Page';
import { routing } from '@/lib/i18n/routing';

/**
 * What `capabilities.canSaveHistory` has meant since `B-066`: the resumes an
 * account has made, newest first.
 *
 * A route of its own rather than a panel on the result screen — the reader
 * comes here to find a resume they made before, which is the opposite journey
 * from looking at the one just built.
 */
export default async function HistoryPage({ params }: PageProps<'/[locale]/history'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'History' });

  return (
    <Page width="narrow">
      <PageHeader title={t('title')} description={t('description')} />
      <History />
    </Page>
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/history'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'History' });
  return { title: t('title') };
}
