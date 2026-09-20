import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import { absoluteUrl, alternatesFor } from '@/lib/seo';
import { buttonVariants } from '@/components/ui/button';

/**
 * How the product works, in one page (D14).
 *
 * **This is what § 55's "SEO landing + blog" became**, and the swap was a
 * decision rather than a shortcut: a blog is a pipeline, and a pipeline with
 * nothing written for it is a maintenance cost that indexes nothing. What a
 * search engine can actually use is a page that answers the question somebody
 * arrives with — how is a page limit *guaranteed*, and what stops a language
 * model inventing a job — and there is exactly one of those to write.
 *
 * **Outside `(app)`, like the landing and the legal pages**, so it costs the
 * anonymous funnel nothing: no providers, no client JavaScript of its own. A
 * plain `<a>` with an explicit locale prefix rather than next-intl's `Link`,
 * for the reason the landing page states — that one only works where
 * `NextIntlClientProvider` lives.
 *
 * **It explains rather than sells.** The claims here are the ones the product
 * can keep, said in the same words the rest of the product uses: counts
 * rather than a percentage, a limit that is calculated rather than hoped for,
 * and a model that chooses between sentences somebody wrote instead of
 * writing its own.
 */

/** The steps, in the order somebody meets them. */
const STEP_KEYS = ['profile', 'posting', 'selection', 'document'] as const;

/** The three questions the page exists to answer. */
const QUESTION_KEYS = ['pageLimit', 'invention', 'ats'] as const;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/how-it-works'>): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('HowItWorks');
  const description = t('intro');

  return {
    title: t('title'),
    description,
    alternates: alternatesFor(locale, '/how-it-works'),
    openGraph: {
      title: t('title'),
      description,
      url: absoluteUrl(locale, '/how-it-works'),
      locale,
    },
  };
}

export default async function HowItWorksPage({ params }: PageProps<'/[locale]/how-it-works'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();

  // Every page calls this, not only the parent layout: Next renders layouts
  // and pages in parallel, so the parent's call is not guaranteed to have run
  // first and next-intl would mark this route dynamic.
  setRequestLocale(locale);
  const t = await getTranslations('HowItWorks');

  return (
    <main id="main" tabIndex={-1} className="flex-1 outline-none">
      <div className="mx-auto flex max-w-3xl flex-col gap-12 px-8 py-16">
        <header className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground max-w-prose">{t('intro')}</p>
        </header>

        <section aria-labelledby="steps-heading" className="flex flex-col gap-6">
          <h2 id="steps-heading" className="text-2xl font-semibold tracking-tight">
            {t('stepsHeading')}
          </h2>

          {/* An ordered list, because the order is the explanation. */}
          <ol className="flex flex-col gap-6">
            {STEP_KEYS.map((key, index) => (
              <li key={key} className="flex flex-col gap-1">
                <h3 className="font-medium">
                  {index + 1}. {t(`steps.${key}.title`)}
                </h3>
                <p className="text-muted-foreground max-w-prose">{t(`steps.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="questions-heading" className="flex flex-col gap-6">
          <h2 id="questions-heading" className="text-2xl font-semibold tracking-tight">
            {t('questionsHeading')}
          </h2>
          <ul className="flex flex-col gap-6">
            {QUESTION_KEYS.map((key) => (
              <li key={key} className="flex flex-col gap-1">
                <h3 className="font-medium">{t(`questions.${key}.title`)}</h3>
                <p className="text-muted-foreground max-w-prose">{t(`questions.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <a href={`/${locale}/profile`} className={`${buttonVariants({ size: 'lg' })} self-start`}>
          {t('cta')}
        </a>
      </div>
    </main>
  );
}
