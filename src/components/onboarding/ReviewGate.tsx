'use client';

/**
 * § 31.6's review screen — the one step in the product that cannot be
 * skipped.
 *
 * The reason is stated plainly in the section: extraction is never perfectly
 * accurate, and an error nobody looked at propagates into **every** CV made
 * from the profile afterwards. So there is no "skip" control here, and the
 * only way on is a button that says the reader has looked.
 *
 * It is a gate, not a lock. Nothing server-side records that anyone passed
 * through — there is no endpoint that could — and someone who types
 * `/profile` into the address bar arrives at the same editor. What the
 * product owes is that no route it offers goes around this one.
 *
 * **The editor is the review.** § 31.6 asks for inline editing with no
 * separate mode, which is exactly what `ProfileEditor` already is: sections
 * closed by default, opened one at a time, each field saving itself.
 * Rebuilding a read-only version of it would be a second thing to keep true.
 *
 * **Two of § 31.6's design rules are not implemented, and cannot be today.**
 * Problematic sections should start open and critical warnings should hold
 * the confirm button closed; both need to know *which* sections are
 * problematic, and the wire carries only a count (`F-018`). What is drawn
 * instead says what is true: how many things extraction was unsure about,
 * without pointing at any of them.
 */

import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { jobKeys } from '@/lib/api/queryKeys';
import { useRouter } from '@/lib/i18n/navigation';

export type ReviewGateProps = {
  /** The import job, when the reader arrived straight from it. */
  jobId?: string;
};

export function ReviewGate({ jobId }: ReviewGateProps) {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const queryClient = useQueryClient();

  /**
   * Read once, at mount, and never again.
   *
   * The job is terminal by the time this screen exists, so there is nothing
   * to subscribe to — and the entry is garbage collected once the progress
   * screen's observer goes, which is a reason to take the value rather than
   * to keep asking for it.
   *
   * It is **empty after a reload**, and that is not a bug in this component:
   * `GET /jobs/{id}` publishes no field an import outcome fits in, so the
   * count exists only in the memory of the tab that watched the job finish
   * (`F-018`). The screen is written to be correct without it.
   */
  const [warnings] = useState(() => {
    if (!jobId) return 0;

    const cached = queryClient.getQueryData<{ result?: Record<string, unknown> }>(
      jobKeys.status(jobId),
    );
    const count = cached?.result?.warningCount;

    return typeof count === 'number' ? count : 0;
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t('reviewTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('reviewBody')}</p>

        {warnings > 0 && (
          // A note, not a warning: nothing is broken and there is nothing to
          // retry. The same distinction the thin-profile note is drawn on.
          <p
            role="status"
            data-testid="review-warnings"
            className="border-border bg-muted/50 rounded-md border px-3 py-2 text-sm"
          >
            {t('reviewWarnings', { count: warnings })}
          </p>
        )}
      </header>

      <ProfileEditor />

      {/*
        At the end rather than pinned: the button means "I have read this",
        and one that follows the reader down the page can be pressed without
        the page having been read.
      */}
      <div className="border-border flex justify-end border-t pt-4">
        <Button type="button" onClick={() => router.push('/generate')}>
          {t('confirm')}
        </Button>
      </div>
    </div>
  );
}
