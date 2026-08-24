import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GenerateScreen } from '@/components/generation/GenerateScreen';
import { routing } from '@/lib/i18n/routing';

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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">{t('intro')}</p>
      </header>

      <GenerateScreen />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/generate'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Generation' });
  return { title: t('title') };
}
