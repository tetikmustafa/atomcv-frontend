import { getLocale, getTranslations } from 'next-intl/server';
import { APP_NAME } from '@/lib/seo';
import { Logo } from './Logo';

const REPOSITORY_URL = 'https://github.com/tetikmustafa/atomcv-frontend';

const LINK_CLASS = 'hover:text-foreground underline-offset-4 hover:underline';

/**
 * At the foot of every page, so the legal documents are always one click away.
 *
 * Plain anchors rather than next-intl's `Link`. That component needs
 * `NextIntlClientProvider`, and the provider serialises the whole message
 * catalogue into the HTML — a steep price on marketing pages for a handful of
 * links that are ordinary document navigations. The locale prefix is added
 * here instead.
 *
 * Rendered by each area rather than by the root layout, so in the app it sits
 * in the content column beside the sidebar instead of running beneath it.
 *
 * Bölüm 57.3: session cookie plus cookie-free analytics means no consent
 * banner is required. If that ever changes, it changes here.
 */
export async function SiteFooter() {
  const [t, locale] = await Promise.all([getTranslations('Footer'), getLocale()]);

  return (
    <footer className="text-muted-foreground border-t text-sm">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <span className="text-foreground">
            <Logo />
          </span>
          <p className="max-w-xs">{t('tagline')}</p>
        </div>

        <nav aria-label={t('product')} className="flex flex-wrap gap-x-10 gap-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-foreground text-xs font-medium tracking-wide uppercase">
              {t('product')}
            </p>
            {/*
              First, because it is the only one here a reader might want rather
              than need, and the only route on this page that is not a dead end
              for somebody deciding whether to try the product (D14).
            */}
            <a href={`/${locale}/how-it-works`} className={LINK_CLASS}>
              {t('howItWorks')}
            </a>
            <a href={REPOSITORY_URL} className={LINK_CLASS} rel="noreferrer">
              {t('sourceCode')}
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-foreground text-xs font-medium tracking-wide uppercase">
              {t('legal')}
            </p>
            <a href={`/${locale}/legal/privacy`} className={LINK_CLASS}>
              {t('privacy')}
            </a>
            <a href={`/${locale}/legal/terms`} className={LINK_CLASS}>
              {t('terms')}
            </a>
          </div>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto w-full max-w-5xl px-4 py-4 text-xs sm:px-6 lg:px-8">
          {APP_NAME} · {t('openSource')} · MIT
        </p>
      </div>
    </footer>
  );
}
