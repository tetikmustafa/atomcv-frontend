'use client';

/**
 * A finished generation: what it is, and how to get it.
 *
 * Deliberately thin, and the reason is a missing endpoint rather than a
 * design choice. There is no `GET /generations/{id}` and the `completed`
 * event carries no `matchLevel`, so the fit report § 23.3 specifies — covered
 * skills counted, never a percentage — has no transport (`F-008`). Putting a
 * number here that the server did not compute is the one thing that section
 * forbids by name.
 *
 * The page count is shown when it is known and left out when it is not:
 * it rides the stream and nothing else, so a result reached by reload or by
 * the polling fallback simply does not have it.
 */

import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { useDownloadGeneration, useJobPageCount } from '@/hooks/useGeneration';
import { announce } from '@/stores/announcerStore';

export function GenerationResult({ generationId }: { generationId: string }) {
  const t = useTranslations('Result');
  const pageCount = useJobPageCount(generationId);
  const download = useDownloadGeneration();

  function save() {
    download.mutate(generationId, {
      onSuccess: ({ blob, filename }) => {
        // The browser owns the save dialog; this only hands it the bytes.
        // A plain link would have been simpler and would have turned a `410`
        // into a page of JSON instead of an error with a way out of it.
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = filename ?? `atomcv-${generationId}.pdf`;
        anchor.click();

        URL.revokeObjectURL(url);
        announce(t('announceDownloaded'));
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        {t('ready')}
        {pageCount !== null ? ` ${t('pages', { count: pageCount })}` : ''}
      </p>

      {download.error && <ErrorPanel error={download.error} />}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={download.isPending}>
          {download.isPending ? t('downloading') : t('download')}
        </Button>

        <Link href="/generate" className="text-sm underline underline-offset-4">
          {t('again')}
        </Link>
      </div>
    </div>
  );
}
