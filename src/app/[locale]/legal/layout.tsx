import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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
  const t = await getTranslations('Legal');

  return (
    <main id="main" tabIndex={-1} className="flex-1 outline-none">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-16">
        <p
          role="note"
          className="border-border bg-muted text-muted-foreground rounded-md border px-4 py-3 text-sm"
        >
          {t('draftNotice')}
        </p>
        {children as ReactNode}
      </div>
    </main>
  );
}
