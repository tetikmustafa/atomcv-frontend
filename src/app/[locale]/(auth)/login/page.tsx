import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { routing } from '@/lib/i18n/routing';
import { oneParam } from '@/lib/searchParams';

/**
 * `?next=` is where the reader was standing. It is read here and validated in
 * `safeReturnPath` at the point of use, not on the way past.
 */
export default async function LoginPage({ params, searchParams }: PageProps<'/[locale]/login'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return <LoginScreen next={oneParam(query.next) ?? '/'} />;
}

export async function generateMetadata({ params }: PageProps<'/[locale]/login'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('title') };
}
