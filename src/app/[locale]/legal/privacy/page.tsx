import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalDocument } from '@/components/layout/LegalDocument';
import { routing } from '@/lib/i18n/routing';

/**
 * Sections required by Bölüm 57.1. "Who we share it with" is the one that
 * matters most: sending profile content to a third-party model is the least
 * obvious thing this product does, and a free provider tier that trains on
 * that data has to be stated outright rather than implied.
 */
const SECTION_KEYS = [
  'collect',
  'why',
  'share',
  'retention',
  'rights',
  'deletion',
  'contact',
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Legal.privacy');
  return { title: `${t('title')} — AtomCV` };
}

export default async function PrivacyPage({ params }: PageProps<'/[locale]/legal/privacy'>) {
  const { locale } = await params;

  // Repeated from the layout: layouts and pages render in parallel, so the
  // layout's call is not guaranteed to have run first, and without it
  // next-intl marks this route dynamic.
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('Legal.privacy');

  return (
    <LegalDocument
      title={t('title')}
      sections={SECTION_KEYS.map((key) => ({
        id: key,
        heading: t(key),
        body: t(`${key}Body`),
      }))}
    />
  );
}
