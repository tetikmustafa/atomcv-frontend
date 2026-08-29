'use client';

/**
 * How a profile usually starts: upload the CV you already have (`B-051`).
 *
 * **One code path, account or not** (`B-053`). § 31.6.3 is explicit that
 * anonymous import is the same endpoint and the same pattern; what differs is
 * where the server writes and which allowance it counts, and the screen has
 * no business knowing either. The one place the difference surfaces is the
 * quota refusal, and the catalogue carries that.
 *
 * **The file picker filters on nothing.** `accept` is tempting and wrong: the
 * accepted list has a single owner and the server publishes it in the `415`
 * (`B-051`), so a format added server-side has to start working without a
 * frontend release. A picker that hid `.md` the day the server started
 * reading it would be a client quietly overruling the API.
 */

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { ProgressBar } from '@/components/feedback/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useJobStream } from '@/hooks/useJob';
import { useImportCv, useProfileReplaced } from '@/hooks/useProfileImport';
import { useRouter } from '@/lib/i18n/navigation';
import { announce } from '@/stores/announcerStore';
import { useEffect } from 'react';
import type { Resolution } from '@/types/domain';

/**
 * What this screen can actually do about each way out the server offers.
 *
 * `replace_profile` and `keep_existing_profile` are the two `409` answers and
 * there is no third: merging means atom-level deduplication, which is Stage 4
 * work, so offering it would name an action nothing can perform (`B-060`).
 */
const HANDLED = [
  'replace_profile',
  'keep_existing_profile',
  'retry',
  'switch_to_manual_form',
] as const;

function canResolve(action: Resolution['action']) {
  return (HANDLED as readonly string[]).includes(action);
}

export function ImportScreen() {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<{ jobId: string; streamUrl?: string } | null>(null);

  const start = useImportCv();

  function submit(replace = false) {
    if (!file) return;

    start.mutate(
      { file, ...(replace ? { replace } : {}) },
      {
        onSuccess: (accepted) => {
          if (!accepted.jobId) return;
          setJob({
            jobId: accepted.jobId,
            ...(accepted.streamUrl ? { streamUrl: accepted.streamUrl } : {}),
          });
        },
      },
    );
  }

  function resolve(resolution: Resolution) {
    switch (resolution.action) {
      case 'replace_profile':
        // The same request, one question later — `?mode=replace` is consent,
        // and it is only ever sent because the server offered this button.
        return submit(true);

      case 'keep_existing_profile':
        // Nothing is sent. The profile stays as it is, and the reader goes
        // back to it rather than being left on an upload form they have just
        // decided against.
        start.reset();
        return router.push('/profile');

      case 'retry':
        return submit();

      case 'switch_to_manual_form':
        // Nothing came out of the file, so the way forward is to write it.
        return router.push('/profile');

      default:
        // Unreachable: `canResolve` decides what is drawn.
        return;
    }
  }

  if (job) {
    return (
      <ImportProgress
        jobId={job.jobId}
        {...(job.streamUrl ? { streamUrl: job.streamUrl } : {})}
        onResolve={resolve}
        onStartOver={() => {
          setJob(null);
          setFile(null);
          start.reset();
        }}
      />
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="cv-file">{t('fileLabel')}</Label>
        <input
          ref={input}
          id="cv-file"
          name="file"
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="file:border-border file:bg-background text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="text-muted-foreground text-sm">{t('fileHint')}</p>
      </div>

      {start.error && (
        <ErrorPanel error={start.error} onResolve={resolve} canResolve={canResolve} />
      )}

      <Button type="submit" disabled={!file || start.isPending} className="w-fit">
        {start.isPending ? t('uploading') : t('upload')}
      </Button>
    </form>
  );
}

/**
 * The job, from the 202 to whichever way it ends.
 *
 * Separate from the generation's progress screen rather than shared with it:
 * the two agree on a bar and on nothing else. This one has no phase names to
 * render — the import job publishes no `label` keys — so the caption is this
 * screen's own sentence about what it is doing, which is not rule 8's
 * territory: rule 8 governs text the *server* owns.
 */
function ImportProgress({
  jobId,
  streamUrl,
  onResolve,
  onStartOver,
}: {
  jobId: string;
  streamUrl?: string;
  onResolve: (resolution: Resolution) => void;
  onStartOver: () => void;
}) {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const progress = useJobStream(jobId, streamUrl);
  const profileReplaced = useProfileReplaced();

  const spoken = useRef<string | null>(null);

  useEffect(() => {
    const sentence =
      progress.status === 'completed'
        ? t('announceDone')
        : progress.status === 'failed'
          ? t('announceFailed')
          : t('announceProgress', { pct: progress.pct });

    // On change rather than on render: a live region that repeats itself is
    // one people turn off.
    if (spoken.current === sentence) return;
    spoken.current = sentence;
    announce(sentence, progress.status === 'failed' ? 'assertive' : 'polite');
  }, [t, progress.status, progress.pct]);

  useEffect(() => {
    if (progress.status !== 'completed') return;

    // Everything cached about the profile describes the one that was there
    // before this ran. Dropped *here* rather than at the 202: the rows are
    // written by the worker, so a cache emptied on acceptance would refill
    // from the old profile seconds before the new one existed.
    profileReplaced();

    // `push`, not `replace`: the review is a step of its own and Back should
    // reach the upload form. The job id travels because the review has one
    // thing to say that only the terminal event knows (`F-018`).
    router.push(`/onboarding/review?job=${encodeURIComponent(jobId)}`);
  }, [router, jobId, progress.status, profileReplaced]);

  if (progress.status === 'failed') {
    return (
      <div className="flex flex-col gap-4">
        {/*
          Three of these are the server's and one of them is repeatable:
          `ALL_PROVIDERS_UNAVAILABLE` is the only refusal here worth trying
          again, and it says so by carrying `retry` (`B-051`). Nothing is
          invented — the panel draws what arrived.
        */}
        <ErrorPanel error={progress.failure} onResolve={onResolve} canResolve={canResolve} />
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onStartOver}>
          {t('chooseAnother')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ProgressBar pct={progress.pct} label={t('progressLabel')} valueText={t('reading')} />
      <p className="text-muted-foreground text-sm">{t('reading')}</p>
    </div>
  );
}
