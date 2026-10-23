import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  Download,
  FileStack,
  Minus,
  Ruler,
  ScanSearch,
  ShieldCheck,
  Sigma,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { MarketingHeader } from '@/components/layout/MarketingHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { buttonVariants } from '@/components/ui/button';
import { routing } from '@/lib/i18n/routing';
import { absoluteUrl, alternatesFor, APP_NAME } from '@/lib/seo';
import { cn } from '@/lib/utils';

/**
 * The front page.
 *
 * **A server component with no JavaScript of its own**, and that is a budget,
 * not an accident (`bundle-budget.json`, marketing 200 KB): the icons are
 * inline SVG rendered here, the illustration is markup, and every link is an
 * anchor with its locale prefix — next-intl's `Link` needs the client provider,
 * which would serialise the whole catalogue into this page.
 *
 * The primary action goes to the CV upload, not the editor. The concept
 * document makes that the default path ("value first, effort later": upload,
 * review, first CV), and the editor is one sentence below it for whoever would
 * rather type.
 */
const FEATURES = [
  { key: 'pageLimit', icon: Ruler },
  { key: 'deterministic', icon: Sigma },
  { key: 'noInvention', icon: ShieldCheck },
  { key: 'formats', icon: FileStack },
  { key: 'transparency', icon: ScanSearch },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

const STEPS = [
  { key: 'upload', icon: Upload },
  { key: 'paste', icon: ClipboardPaste },
  { key: 'download', icon: Download },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

/** Concept § 9's table: narrower, never lesser. Values are words, not ticks alone. */
type CompareValue = boolean | 'englishOnly' | 'allLanguages' | 'presets' | 'customise';

const COMPARE = [
  { row: 'upload', guest: true, account: true },
  { row: 'measure', guest: true, account: true },
  { row: 'languages', guest: 'englishOnly', account: 'allLanguages' },
  { row: 'templates', guest: 'presets', account: 'customise' },
  { row: 'controls', guest: false, account: true },
  { row: 'history', guest: false, account: true },
] as const satisfies readonly { row: string; guest: CompareValue; account: CompareValue }[];

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('Landing');
  const description = t('intro', { appName: APP_NAME });

  return {
    title: { absolute: APP_NAME },
    description,
    alternates: alternatesFor(locale),
    openGraph: {
      title: APP_NAME,
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

  const cell = (value: CompareValue) =>
    typeof value === 'string' ? (
      <span>{t(`compare.values.${value}`)}</span>
    ) : value ? (
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-4" aria-hidden="true" />
        <span>{t('compare.yes')}</span>
      </span>
    ) : (
      <span className="text-muted-foreground inline-flex items-center gap-1.5">
        <Minus className="size-4" aria-hidden="true" />
        <span>{t('compare.no')}</span>
      </span>
    );

  return (
    <>
      <MarketingHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {/* ── hero ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden="true"
            className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] opacity-60"
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:px-8">
            <div className="flex flex-col gap-6">
              <p className="bg-card text-muted-foreground w-fit rounded-full border px-3 py-1 text-xs font-medium">
                {t('eyebrow')}
              </p>
              <h1 className="text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
                {t('tagline')}
              </h1>
              <p className="text-muted-foreground max-w-xl text-lg">
                {t('intro', { appName: APP_NAME })}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a href={`/${locale}/onboarding`} className={buttonVariants({ size: 'lg' })}>
                  {t('cta')}
                  <ArrowRight aria-hidden="true" />
                </a>
                <a
                  href={`/${locale}/how-it-works`}
                  className={buttonVariants({ size: 'lg', variant: 'outline' })}
                >
                  {t('ctaHow')}
                </a>
              </div>
              <p className="text-muted-foreground text-sm">
                <a
                  href={`/${locale}/profile`}
                  className="text-foreground underline underline-offset-4"
                >
                  {t('ctaManual')}
                </a>
                {' · '}
                {t('noAccount')}
              </p>
            </div>

            <ProductSketch
              label={t('visual.label')}
              profile={t('visual.profile')}
              posting={t('visual.posting')}
              resume={t('visual.resume')}
              pageLimit={t('visual.pageLimit')}
              matched={t('visual.matched')}
            />
          </div>
        </section>

        {/* ── steps ────────────────────────────────────────────────── */}
        <section
          aria-labelledby="steps-heading"
          className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
        >
          <h2 id="steps-heading" className="max-w-2xl text-3xl font-semibold">
            {t('stepsHeading')}
          </h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map(({ key, icon: Icon }, index) => (
              <li
                key={key}
                className="bg-card shadow-card flex flex-col gap-3 rounded-xl border p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-muted-foreground text-sm font-medium">{index + 1}</span>
                </div>
                <h3 className="text-lg font-semibold">{t(`steps.${key}.title`)}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(`steps.${key}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── features ─────────────────────────────────────────────── */}
        <section aria-labelledby="features-heading" className="bg-card border-y">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <h2 id="features-heading" className="max-w-2xl text-3xl font-semibold">
              {t('featuresHeading')}
            </h2>
            <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ key, icon: Icon }) => (
                <li key={key} className="flex flex-col gap-2">
                  <span className="bg-muted flex size-10 items-center justify-center rounded-lg">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-2 font-semibold">{t(`features.${key}.title`)}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(`features.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── guest and account ────────────────────────────────────── */}
        <section
          aria-labelledby="compare-heading"
          className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
        >
          <div className="flex flex-col gap-2">
            <h2 id="compare-heading" className="text-3xl font-semibold">
              {t('compareHeading')}
            </h2>
            <p className="text-muted-foreground max-w-2xl">{t('compareIntro')}</p>
          </div>
          <div className="bg-card shadow-card overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('compare.feature')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('compare.guest')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('compare.account')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(({ row, guest, account }) => (
                  <tr key={row} className="border-t">
                    <th scope="row" className="px-4 py-3 font-normal">
                      {t(`compare.rows.${row}`)}
                    </th>
                    <td className="px-4 py-3">{cell(guest)}</td>
                    <td className="px-4 py-3">{cell(account)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── closing ──────────────────────────────────────────────── */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <div className="bg-primary text-primary-foreground mx-auto flex w-full max-w-6xl flex-col items-start gap-6 rounded-2xl px-6 py-12 sm:px-12 md:flex-row md:items-center md:justify-between">
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 className="text-2xl font-semibold sm:text-3xl">{t('closingTitle')}</h2>
              <p className="opacity-80">{t('closingBody')}</p>
            </div>
            <a
              href={`/${locale}/onboarding`}
              className={cn(
                buttonVariants({ size: 'lg', variant: 'outline' }),
                'text-foreground shrink-0 border-transparent',
              )}
            >
              {t('cta')}
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
          <p className="text-muted-foreground mx-auto mt-8 max-w-3xl text-center text-sm">
            {t('openSourceNote')}
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * The product in one picture: items on the left, a posting in the middle, a
 * page on the right. Markup rather than an image — no request, sharp at any
 * density, and in the theme's own colours.
 *
 * One labelled figure to assistive technology; the grey bars inside it are
 * decoration and hidden.
 */
function ProductSketch(props: {
  label: string;
  profile: string;
  posting: string;
  resume: string;
  pageLimit: string;
  matched: string;
}) {
  const bar = (width: string, strong = false) => (
    <span
      className={cn(
        'block h-2 rounded-full',
        strong ? 'bg-foreground/70' : 'bg-muted-foreground/25',
        width,
      )}
    />
  );

  return (
    <figure aria-label={props.label} className="relative mx-auto w-full max-w-md">
      <div aria-hidden="true" className="grid grid-cols-[1fr_1.25fr] gap-4">
        <div className="flex flex-col gap-3">
          <div className="bg-card shadow-card flex flex-col gap-2.5 rounded-xl border p-4">
            <p className="text-xs font-medium">{props.profile}</p>
            {['w-[88%]', 'w-[72%]', 'w-[94%]', 'w-[64%]', 'w-[80%]'].map((w, i) => (
              <div key={w + i} className="flex items-center gap-2">
                <span className="border-foreground/40 size-2 shrink-0 rounded-full border" />
                {bar(w)}
              </div>
            ))}
          </div>
          <div className="bg-card shadow-card flex flex-col gap-2.5 rounded-xl border p-4">
            <p className="text-xs font-medium">{props.posting}</p>
            {bar('w-[90%]')}
            {bar('w-[70%]')}
            {bar('w-[82%]')}
          </div>
        </div>

        <div className="bg-card shadow-raised flex flex-col gap-3 rounded-xl border p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">{props.resume}</p>
          </div>
          <span className="bg-foreground/80 block h-3 w-2/3 rounded-full" />
          {bar('w-[45%]')}
          <span className="mt-2 block h-px w-full bg-current opacity-10" />
          {['w-[92%]', 'w-[86%]', 'w-[78%]', 'w-[90%]', 'w-[70%]', 'w-[84%]', 'w-[60%]'].map(
            (w, i) => (
              <div key={w + i} className="flex items-center gap-2">
                <span className="bg-foreground/60 size-1.5 shrink-0 rounded-full" />
                {bar(w, i % 3 === 0)}
              </div>
            ),
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <span className="bg-muted rounded-full px-2 py-0.5 text-[10px] font-medium">
              {props.pageLimit}
            </span>
            <span className="bg-muted rounded-full px-2 py-0.5 text-[10px] font-medium">
              {props.matched}
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}
