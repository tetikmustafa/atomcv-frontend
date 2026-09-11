import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UnsubscribeScreen } from '@/components/settings/UnsubscribeScreen';
import { routing } from '@/lib/i18n/routing';

/**
 * Where a "stop sending me these" link in an email lands (§ 57.7, § 40.3).
 *
 * **A page rather than the endpoint**, because corporate mail gateways fetch
 * every address in a message before anybody reads it: a link that
 * unsubscribed when it was fetched would cut off people who never clicked.
 * The work happens on a button.
 *
 * **Under `(app)` although no session is needed**, and it is the providers
 * that decide it: the screen is a client component that calls the API and
 * resolves its own text, and next-intl's client provider lives in the `(app)`
 * layout. The alternative was a second provider tree for one page.
 *
 * This route reads `searchParams`, so it is rendered on demand rather than
 * prerendered. That is correct here and is why it does not appear in the
 * bundle budget's prerendered list.
 */
export default async function UnsubscribePage({
  params,
  searchParams,
}: PageProps<'/[locale]/unsubscribe'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { t: token } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'Unsubscribe' });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-8 py-12">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      {/* A repeated parameter arrives as an array; one of them is not a token
          any more than none is, so only a single value is passed on. */}
      <UnsubscribeScreen token={typeof token === 'string' ? token : undefined} />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]/unsubscribe'>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Unsubscribe' });

  return {
    title: t('title'),
    // Nothing to index, and a page reached from an inbox has no business in
    // search results.
    robots: { index: false, follow: false },
  };
}
