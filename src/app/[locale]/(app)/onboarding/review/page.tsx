import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ReviewGate } from '@/components/onboarding/ReviewGate';
import { routing } from '@/lib/i18n/routing';
import { oneParam } from '@/lib/searchParams';

/**
 * The mandatory review after extraction (§ 31.6).
 *
 * A route of its own so a reload lands on it rather than back on the upload
 * form: the profile exists by the time anyone is here, and the step is about
 * that profile.
 *
 * `?job=` is the import that produced it. Optional, and the screen is correct
 * without it — it is how the one fact the profile does not carry, the number
 * of things extraction was unsure about, reaches the page (`F-018`).
 */
export default async function ReviewPage({
  params,
  searchParams,
}: PageProps<'/[locale]/onboarding/review'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-12">
      <ReviewGate {...(oneParam(query.job) ? { jobId: oneParam(query.job)! } : {})} />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/onboarding/review'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Onboarding' });
  return { title: t('reviewTitle') };
}
