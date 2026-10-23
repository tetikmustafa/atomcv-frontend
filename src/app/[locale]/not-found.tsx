import { getLocale, getTranslations } from 'next-intl/server';
import { FileQuestion } from 'lucide-react';
import { MarketingHeader } from '@/components/layout/MarketingHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { buttonVariants } from '@/components/ui/button';

/**
 * The 404, in the reader's language and in the product's frame.
 *
 * There was none, so a mistyped address showed Next's bare default — no
 * header, no way back, and English on a Turkish URL. It is reached two ways:
 * a `notFound()` from a page (an unknown generation, an unknown locale
 * segment further down) and `[...rest]`, which turns every unmatched path
 * under a locale into that call.
 *
 * A server component with anchors, like the rest of the public frame: a 404
 * should cost nothing to show.
 */
export default async function NotFound() {
  const [t, locale] = await Promise.all([getTranslations('Shell'), getLocale()]);

  return (
    <>
      <MarketingHeader />
      <main id="main" tabIndex={-1} className="flex flex-1 items-center outline-none">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-20 text-center">
          <span className="bg-muted flex size-14 items-center justify-center rounded-full">
            <FileQuestion className="size-6" aria-hidden="true" />
          </span>
          <p className="text-muted-foreground text-sm font-medium">404</p>
          <h1 className="text-3xl font-semibold">{t('notFoundTitle')}</h1>
          <p className="text-muted-foreground">{t('notFoundBody')}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <a href={`/${locale}`} className={buttonVariants()}>
              {t('notFoundHome')}
            </a>
            <a href={`/${locale}/profile`} className={buttonVariants({ variant: 'outline' })}>
              {t('notFoundProfile')}
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
