import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('intro')}</p>
      </header>

      <ImportScreen />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/onboarding'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Onboarding' });
  return { title: t('title') };
}
