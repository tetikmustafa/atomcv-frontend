import { getTranslations } from 'next-intl/server';
import { Page } from '@/components/layout/Page';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * What a screen looks like before its server half has arrived.
 *
 * The shape of a page — a title, a line under it, two cards — rather than a
 * spinner, so nothing jumps when the real one lands. The sentence is for
 * assistive technology; the grey blocks are hidden from it.
 */
export default async function Loading() {
  const t = await getTranslations('Shell');

  return (
    <Page>
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </Page>
  );
}
