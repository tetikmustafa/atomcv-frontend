import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { routing } from '@/lib/i18n/routing';

/**
 * Shared frame for the legal documents.
 *
 * These pages live under `[locale]` rather than beside it as XI-B.3 draws
 * them. Outside the segment they cannot be translated, and a privacy policy
 * a Turkish user cannot read is not a privacy policy.
 *
 * `setRequestLocale` is what keeps them statically rendered. Without it
 * next-intl marks the subtree dynamic, and these documents change about as
 * often as the licence does.
 */
export default async function LegalLayout({ children, params }: LayoutProps<'/[locale]/legal'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  // The header, the draft notice and `<main>` are each document's own
  // (`LegalDocument`): the header's language links keep the page's path,
  // which a layout cannot know.
  return (
    <>
      {children as ReactNode}
      <SiteFooter />
    </>
  );
}
