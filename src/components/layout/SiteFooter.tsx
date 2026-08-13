import { getLocale, getTranslations } from 'next-intl/server';

const REPOSITORY_URL = 'https://github.com/tetikmustafa/atomcv-frontend';

const LINK_CLASS = 'hover:text-foreground underline-offset-4 hover:underline';

/**
 * Rendered on every page, so the legal documents are always one click away.
 *
 * Plain anchors rather than next-intl's `Link`. That component needs
 * `NextIntlClientProvider`, and the provider serialises the whole message
 * catalogue into the HTML — a steep price on marketing pages for three links
 * that are ordinary document navigations. The locale prefix is added here
 * instead.
 *
 * Bölüm 57.3: session cookie plus cookie-free analytics means no consent
 * banner is required. If that ever changes, it changes here.
 */
export async function SiteFooter() {
  const [t, locale] = await Promise.all([getTranslations('Footer'), getLocale()]);

  return (
    <footer className="border-border text-muted-foreground border-t px-8 py-6 text-sm">
      <nav className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2">
        <a href={`/${locale}/legal/privacy`} className={LINK_CLASS}>
          {t('privacy')}
        </a>
        <a href={`/${locale}/legal/terms`} className={LINK_CLASS}>
          {t('terms')}
        </a>
        <a href={REPOSITORY_URL} className={LINK_CLASS} rel="noreferrer">
          {t('sourceCode')}
        </a>
      </nav>
    </footer>
  );
}
