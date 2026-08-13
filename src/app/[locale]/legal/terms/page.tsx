import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalDocument } from '@/components/layout/LegalDocument';
import { routing } from '@/lib/i18n/routing';

/** Points required by Bölüm 57.2. */
const SECTION_KEYS = ['noGuarantee', 'estimate', 'accuracy', 'abuse', 'noSla'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Legal.terms');
  return { title: `${t('title')} — AtomCV` };
}

export default async function TermsPage({ params }: PageProps<'/[locale]/legal/terms'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('Legal.terms');

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
