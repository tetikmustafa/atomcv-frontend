import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import { routing } from '@/lib/i18n/routing';

/**
 * § 36.1's settings route. It holds one thing today — deleting the account —
 * and exists because § 57.4 asks for that to be reachable and explained.
 */
export default async function SettingsPage({ params }: PageProps<'/[locale]/settings'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Settings' });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-12">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <SettingsScreen />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/settings'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Settings' });
  return { title: t('title') };
}
