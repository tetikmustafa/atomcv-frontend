import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';

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
 * The call to action arrives with the anonymous entry route in Stage 1. A
 * button that leads to a 404 would be worse than no button.
 */
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
