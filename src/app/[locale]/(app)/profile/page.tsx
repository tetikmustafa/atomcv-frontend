import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { routing } from '@/lib/i18n/routing';

/**
 * The profile editor route.
 *
 * A server component that renders one client component. `setRequestLocale`
 * has to be called *here* and not only in the layout: Next renders layouts
 * and pages in parallel, so the parent's call is not guaranteed to have run
 * first, and next-intl marks the route dynamic when it has not. That failure
 * is silent — the page still works, it is just rendered on demand.
 *
 * The editor itself fetches nothing on the server. `client.ts` throws on a
 * server-side call by design (EK D.6): the session cookie is HttpOnly and
 * there is no decided way to forward it, so server rendering produces shell
 * and static text only.
 */
export default async function ProfilePage({ params }: PageProps<'/[locale]/profile'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return <ProfileEditor />;
}

export async function generateMetadata({ params }: PageProps<'/[locale]/profile'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Editor.profile' });
  return { title: t('title') };
}
