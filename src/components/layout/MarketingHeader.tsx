import { getLocale, getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/components/ui/button';
import { locales } from '@/lib/i18n/locales';
import { APP_NAME } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';

/**
 * The header of the public pages — the landing page, how it works, the legal
 * documents.
 *
 * A server component with plain anchors and **no JavaScript of its own**: the
 * landing page's own bundle is 0 KB and this keeps it there. That rules out
 * the app's sheet, so on a phone this is the mark, the language links and one
 * button; the full navigation lives inside the app.
 *
 * The language links are links, not a select: changing language here is a
 * navigation to the other prefix, which an anchor does without a line of
 * script — and it keeps the same page (`path`).
 */
export async function MarketingHeader({ path = '' }: { path?: string }) {
  const [t, nav, locale] = await Promise.all([
    getTranslations('Landing'),
    getTranslations('Nav'),
    getLocale(),
  ]);
  const localeNames = await getTranslations('Locale');

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <a
          href={`/${locale}`}
          aria-label={nav('home', { appName: APP_NAME })}
          className="rounded-lg text-lg"
        >
          <Logo />
        </a>

        <nav
          aria-label={localeNames('label')}
          className="ml-auto flex items-center text-sm sm:gap-1"
        >
          {locales.map((option) => (
            <a
              key={option}
              href={`/${option}${path}`}
              lang={option}
              hrefLang={option}
              aria-current={option === locale ? 'true' : undefined}
              className={cn(
                'rounded-md px-2 py-1 uppercase',
                option === locale
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span aria-hidden="true">{option}</span>
              <span className="sr-only">{localeNames(`names.${option}`)}</span>
            </a>
          ))}
        </nav>

        {/*
          On a phone too. It was the one hidden below `sm` to make room, and a
          returning person on their phone then had no way to sign in from the
          front page short of starting a guest session first. The call to try
          it gives way instead: the hero's own button says the same thing a
          few pixels further down.
        */}
        <a href={`/${locale}/login`} className={buttonVariants({ variant: 'ghost' })}>
          {t('signIn')}
        </a>
        <a href={`/${locale}/onboarding`} className={cn(buttonVariants(), 'hidden sm:inline-flex')}>
          {t('tryIt')}
        </a>
      </div>
    </header>
  );
}
