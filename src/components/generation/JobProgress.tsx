'use client';

/**
 * A running generation, from the 202 to whichever way it ends.
 *
 * The bar is not the only thing carrying progress: rule 6 exists because a
 * moving bar and a coloured dot are invisible to a screen reader, and here
 * they are the *only* signal that the application is doing anything at all.
 * Every phase change is announced.
 */

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { usePhaseLabel } from '@/hooks/useErrorMessage';
import { useJobStream } from '@/hooks/useGeneration';
import { announce } from '@/stores/announcerStore';
import type { Resolution } from '@/types/domain';

export type JobProgressProps = {
  jobId: string;
  /** The one the 202 handed back. Reconstructed from `jobId` when absent. */
  streamUrl?: string;
  onResolve: (resolution: Resolution) => void;
  canResolve: (action: Resolution['action']) => boolean;
  /** Starting over: a failed generation leaves the posting where it was. */
  onStartOver: () => void;
};

export function JobProgress({
  jobId,
  streamUrl,
  onResolve,
  canResolve,
  onStartOver,
}: JobProgressProps) {
  const t = useTranslations('Generation');
  const phaseName = usePhaseLabel();
  const router = useRouter();

  const progress = useJobStream(jobId, streamUrl);
  const caption = phaseName(progress.phaseKey) ?? t('queued');

  // Announced on change rather than on render: the bar moves through the same
  // percentage twice in a job that stalls, and a live region that repeats
  // itself is a live region people turn off.
  const spoken = useRef<string | null>(null);

  useEffect(() => {
    const sentence =
      progress.status === 'completed'
        ? t('announceDone')
        : progress.status === 'failed'
          ? t('announceFailed')
          : t('announceProgress', { phase: caption, pct: progress.pct });

    if (spoken.current === sentence) return;
    spoken.current = sentence;
    announce(sentence, progress.status === 'failed' ? 'assertive' : 'polite');
  }, [t, caption, progress.status, progress.pct]);

  useEffect(() => {
    if (progress.status !== 'completed' || !progress.generationId) return;

    // `replace`, not `push`: the job is finished and its progress screen has
    // nothing left to show, so Back should reach the form the user came from
    // rather than a bar frozen at 100%.
    router.replace(`/generations/${progress.generationId}`);
  }, [router, progress.status, progress.generationId]);

  if (progress.status === 'failed') {
    return (
      <div className="flex flex-col gap-4">
        <ErrorPanel error={progress.failure} onResolve={onResolve} canResolve={canResolve} />
        <button
          type="button"
          onClick={onStartOver}
          className="border-border hover:bg-muted w-fit rounded-md border px-4 py-2 text-sm"
        >
          {t('startOver')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="progressbar"
        aria-label={t('progressLabel')}
        aria-valuenow={progress.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        // The caption is the accessible description rather than a second
        // announcement: the live region already says it, and a screen reader
        // that read both would say every phase twice.
        aria-valuetext={caption}
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full transition-[width] duration-300"
          style={{ width: `${progress.pct}%` }}
        />
      </div>

      <p data-testid="phase-caption" className="text-muted-foreground text-sm">
        {caption}
        {progress.detail ? ` · ${progress.detail}` : ''}
      </p>
    </div>
  );
}
