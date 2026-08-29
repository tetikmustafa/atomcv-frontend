import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { SignInLanding } from '@/components/auth/SignInLanding';
import { routing } from '@/lib/i18n/routing';
import { oneParam } from '@/lib/searchParams';

/**
 * `/auth/complete` — where the OAuth callback puts the browser (`B-048`).
 *
 * The path is the server's to choose, which is why it sits under a literal
 * `auth` segment inside the `(auth)` group rather than at `/complete`. The
 * server redirects without a locale prefix and the middleware adds one, so
 * nothing here has to agree with it about language.
 */
export default async function AuthCompletePage({
  params,
  searchParams,
}: PageProps<'/[locale]/auth/complete'>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return <SignInLanding next={oneParam(query.next)} profile={oneParam(query.profile)} />;
}
