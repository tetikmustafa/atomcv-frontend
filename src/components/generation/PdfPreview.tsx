'use client';

/**
 * The PDF, on the result screen (concept § 9, stage 5).
 *
 * This was a deliberate gap with a measured reason — react-pdf is ~300 KB and
 * the only new thing it could show was the PDF itself. The reason held for
 * react-pdf and not for the question: the browser already renders PDFs, so an
 * `<iframe>` on the downloaded bytes costs nothing in the bundle.
 *
 * **On demand, not on load.** A download re-renders the document from its
 * snapshot (nothing is stored yet, § 57.4), so a preview that loaded itself
 * would be a compilation on every visit to a result — most of them by people
 * who only came to press "Download". One press, then cached for the session.
 *
 * The frame is the file itself, so what it shows is exactly what downloads:
 * the page limit can be checked by eye.
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadGeneration } from '@/lib/api/endpoints/generations';
import { generationKeys } from '@/lib/api/queryKeys';

export function PdfPreview({ generationId }: { generationId: string }) {
  const t = useTranslations('Result');
  const [asked, setAsked] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const pdf = useQuery({
    queryKey: [...generationKeys.detail(generationId), 'preview'],
    queryFn: () => downloadGeneration(generationId, 'pdf'),
    enabled: asked,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });

  // An object URL per blob, revoked when the blob or the screen goes away —
  // each one pins the bytes in memory until it is.
  useEffect(() => {
    const blob = pdf.data?.blob;
    if (!blob || typeof URL.createObjectURL !== 'function') return;

    const created = URL.createObjectURL(blob);
    // An external resource with its own lifetime, which is what an effect is
    // for: created with the blob, revoked by the cleanup. A memo could create
    // it but has nowhere to revoke it, and a URL made during render would be
    // made twice under StrictMode and leak the first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [pdf.data]);

  if (!asked) {
    return (
      <div className="bg-muted/40 flex aspect-[1/1.414] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center">
        <p className="text-muted-foreground max-w-xs text-sm">{t('previewHint')}</p>
        <Button type="button" variant="outline" onClick={() => setAsked(true)}>
          <Eye aria-hidden="true" />
          {t('previewShow')}
        </Button>
      </div>
    );
  }

  if (pdf.error) return <ErrorPanel error={pdf.error} onRetry={() => void pdf.refetch()} />;

  if (!url) {
    return (
      <div className="flex flex-col gap-2">
        <p role="status" className="sr-only">
          {t('previewLoading')}
        </p>
        <Skeleton className="aspect-[1/1.414] w-full" />
      </div>
    );
  }

  return (
    <iframe
      src={`${url}#view=FitH`}
      title={t('previewFrame')}
      className="aspect-[1/1.414] w-full rounded-lg border bg-white"
    />
  );
}
