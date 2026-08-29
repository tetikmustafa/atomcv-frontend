import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthErrorNotice } from '@/components/auth/AuthErrorNotice';
import { routing } from '@/lib/i18n/routing';
import { oneParam } from '@/lib/searchParams';

/**
 * `/auth/error?code=…&reason=…` — where a sign-in that did not finish lands
 * (`B-048`).
 */
export default async function AuthErrorPage({
  params,
  searchParams,
}: PageProps<'/[locale]/auth/error'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return <AuthErrorNotice code={oneParam(query.code)} reason={oneParam(query.reason)} />;
}

export async function generateMetadata({ params }: PageProps<'/[locale]/auth/error'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('errorTitle') };
}
