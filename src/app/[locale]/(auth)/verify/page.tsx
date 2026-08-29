import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { VerifyScreen } from '@/components/auth/VerifyScreen';
import { routing } from '@/lib/i18n/routing';
import { oneParam } from '@/lib/searchParams';

/**
 * `/verify?s=…&v=…` — where the sign-in link lands (`B-049`).
 *
 * A server component that reads the two halves off the URL and renders a
 * button. It deliberately does **not** redeem them: this request is a `GET`,
 * and mail scanners make it without a person being present (§ 40.3).
 */
export default async function VerifyPage({ params, searchParams }: PageProps<'/[locale]/verify'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return <VerifyScreen selector={oneParam(query.s)} verifier={oneParam(query.v)} />;
}

export async function generateMetadata({ params }: PageProps<'/[locale]/verify'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('verifyTitle') };
}
