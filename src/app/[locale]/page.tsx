import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import { absoluteUrl, alternatesFor } from '@/lib/seo';
import { buttonVariants } from '@/components/ui/button';

const FEATURE_KEYS = [
  'pageLimit',
  'deterministic',
  'noInvention',
  'formats',
  'transparency',
] as const;

/**
 * Landing page (SSG).
 *
 * Deliberately a server component with no client JavaScript of its own. This
 * is first contact with the product and the thinnest point of the anonymous
 * funnel (Bölüm 12), so it carries nothing the app shell needs.
 *
 * The call to action leads straight to the profile editor, which is the only
 * destination that exists — the onboarding wizard `spec/09-frontend.md` § 36.1
 * lists is not built yet. It was deliberately absent until Stage 1 finished
 * the editor, on the grounds that a button leading to a 404 is worse than no
 * button; the flip side, learned the hard way, is that a product with no way
 * in from its own front page looks broken to anyone who has not memorised the
 * route.
 *
 * A plain `<a>` with an explicit locale prefix, not next-intl's `Link`: that
 * one only works under `(app)`, where `NextIntlClientProvider` lives. And no
 * `Button`, only its classes — this page still ships no client JavaScript of
 * its own, which is the point of it being the thinnest part of the anonymous
 * funnel.
 */
/**
 * The only page of the product a stranger arrives at, so the only one whose
 * metadata has a reader.
 *
 * The description is the same sentence the page opens with rather than a
 * second one written for crawlers: a summary that differs from the page is
 * how a search result stops matching what it leads to.
 */
export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('Landing');
  const description = t('intro');

  return {
    // The site name, not "AtomCV — AtomCV": this page *is* the product, so it
    // opts out of the template rather than filling it in.
    title: { absolute: 'AtomCV' },
    description,
    alternates: alternatesFor(locale),
    openGraph: {
      title: 'AtomCV',
      description,
      url: absoluteUrl(locale),
      locale,
    },
  };
}

export default async function LandingPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const t = await getTranslations('Landing');

  return (
    <main id="main" tabIndex={-1} className="flex-1 outline-none">
      <div className="mx-auto flex max-w-3xl flex-col gap-12 px-8 py-16">
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">AtomCV</h1>
          <p className="text-xl">{t('tagline')}</p>
          <p className="text-muted-foreground max-w-prose">{t('intro')}</p>

          <a href={`/${locale}/profile`} className={`${buttonVariants({ size: 'lg' })} self-start`}>
            {t('cta')}
          </a>
        </header>

        <section aria-labelledby="features-heading" className="flex flex-col gap-6">
          <h2 id="features-heading" className="text-2xl font-semibold tracking-tight">
            {t('featuresHeading')}
          </h2>
          <ul className="flex flex-col gap-6">
            {FEATURE_KEYS.map((key) => (
              <li key={key} className="flex flex-col gap-1">
                <h3 className="font-medium">{t(`features.${key}.title`)}</h3>
                <p className="text-muted-foreground max-w-prose">{t(`features.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-muted-foreground max-w-prose text-sm">{t('openSourceNote')}</p>
      </div>
    </main>
  );
}
