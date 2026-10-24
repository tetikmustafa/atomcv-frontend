import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GenerateScreen } from '@/components/generation/GenerateScreen';
import { UsageNote } from '@/components/generation/UsageNote';
import { routing } from '@/lib/i18n/routing';
import { Page, PageHeader } from '@/components/layout/Page';

/**
 * The generation route.
 *
 * `setRequestLocale` is called here as well as in the layout: Next renders
 * layouts and pages in parallel, so the parent's call is not guaranteed to
 * have run first, and next-intl marks the route dynamic when it has not —
 * silently, which is why it has to be repeated rather than trusted.
 */
export default async function GeneratePage({ params }: PageProps<'/[locale]/generate'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Generation' });

  return (
    <Page>
      <div className="flex flex-col gap-3">
        <PageHeader title={t('title')} description={t('intro')} />
        {/*
          Outside `GenerateScreen` so it survives the swap from form to
          progress: the count moves the moment a job is queued, and a note
          that unmounted at that moment would never show the change it is
          there to report.
        */}
        <UsageNote />
      </div>

      <GenerateScreen />
    </Page>
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/generate'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Generation' });
  return { title: t('title') };
}
