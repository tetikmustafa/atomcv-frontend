import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Page, PageHeader } from '@/components/layout/Page';
import { ImportScreen } from '@/components/onboarding/ImportScreen';
import { routing } from '@/lib/i18n/routing';

/**
 * Where a profile usually starts (§ 36.1's onboarding, `B-051`).
 *
 * Under `(app)` rather than beside the sign-in pages: importing a CV needs no
 * account (`B-053`), and it is the product rather than a way into it.
 */
export default async function OnboardingPage({ params }: PageProps<'/[locale]/onboarding'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Onboarding' });

  return (
    <Page width="narrow">
      <PageHeader title={t('title')} description={t('intro')} />
      <ImportScreen />
    </Page>
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/onboarding'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Onboarding' });
  return { title: t('title') };
}
