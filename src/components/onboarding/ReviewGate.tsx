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
 * **Confirm is always enabled, and that is a decision rather than a gap**
 * (§ 31.6.4). The design rule that held it closed until "critical warnings"
 * were resolved was removed: `ExtractionWarningCode` is closed, and all six
 * of its values describe a field the reader can fix right here. A blocking
 * class of warning never existed.
 *
 * **Problematic sections open themselves**, which is the other half of that
 * decision (`B-067`). The wire used to carry a count and nothing else, so
 * the screen could say how many things were unsure without pointing at any
 * of them; `warnings[]` carries places now.
 */

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { getJob, type JobStatus } from '@/lib/api/endpoints/jobs';
import { jobKeys } from '@/lib/api/queryKeys';
import { useRouter } from '@/lib/i18n/navigation';
import { useSections } from '@/hooks/useProfile';
import { useEditorUiStore } from '@/stores/editorUiStore';

export type ReviewGateProps = {
  /** The import job, when the reader arrived straight from it. */
  jobId?: string;
};

export function ReviewGate({ jobId }: ReviewGateProps) {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const expandSections = useEditorUiStore((state) => state.expandSections);

  /**
   * The job, read from the same cache entry the stream filled.
   *
   * It survives a reload now: `GET /jobs/{id}` answers a completed import
   * with what it wrote and what it could not settle (`B-067`), so this is a
   * fetch when the tab is new and a cache hit when it is the tab that watched
   * the job finish. `staleTime: Infinity` because a terminal job has nothing
   * left to say — without it, every mount of this screen would re-ask for an
   * answer that cannot change.
   */
  const { data: job } = useQuery<JobStatus>({
    queryKey: jobKeys.status(jobId ?? ''),
    queryFn: () => getJob(jobId!),
    enabled: Boolean(jobId),
    staleTime: Infinity,
  });

  const { data: sections } = useSections();

  /**
   * Warnings resolved against the profile in hand.
   *
   * `sectionOrder` is a `displayOrder`, not an id — the field `GET /profile`
   * already publishes — so this endpoint never has to read rows back to name
   * them. A warning that names no section is **document-level** and is
   * counted without opening anything: the model dropped something it could
   * not place, which is worth saying and not worth pointing at.
   */
  const { placed, placedSectionIds, unplaced } = useMemo(() => {
    const ids = new Set<string>();

    const placedList = (job?.warnings ?? []).map((warning) => {
      const section = sections?.find(
        (candidate) => candidate.displayOrder === warning.sectionOrder,
      );

      // A `sectionOrder` pointing at a section this profile does not have is
      // treated as placeless rather than dropped: the count stays honest even
      // when the two sides disagree about the profile.
      if (warning.sectionOrder === undefined || !section?.id) {
        return { code: warning.code, title: undefined };
      }

      ids.add(section.id);
      return { code: warning.code, title: section.title };
    });

    return {
      placed: placedList,
      placedSectionIds: [...ids],
      unplaced: placedList.filter((warning) => warning.title === undefined).length,
    };
  }, [job?.warnings, sections]);

  // Joined rather than passed as the array: the array is rebuilt on every
  // render of a memo whose inputs are objects, and the effect would then
  // re-open sections the reader had just closed.
  const openKey = placedSectionIds.join(',');

  useEffect(() => {
    if (openKey) expandSections(openKey.split(','));
  }, [openKey, expandSections]);

  // The server's own count, which it promises equals `warnings.length`. Read
  // from the field rather than from the array so a body that carried the
  // number without the list would still say something true.
  const total = job?.warningCount ?? job?.warnings?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t('reviewTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('reviewBody')}</p>

        {total > 0 && (
          // A note, not a warning: nothing is broken and there is nothing to
          // retry. The same distinction the thin-profile note is drawn on.
          <p
            role="status"
            data-testid="review-warnings"
            className="border-border bg-muted/50 rounded-md border px-3 py-2 text-sm"
          >
            {t('reviewWarnings', { count: total })}
            {placedSectionIds.length > 0 && ` ${t('reviewWarningsOpened')}`}
            {/*
              Said separately because the two kinds are separate: opening the
              sections answers the placed ones, and a reader told only that
              would think everything had been pointed at.
            */}
            {unplaced > 0 && ` ${t('reviewWarningsElsewhere', { count: unplaced })}`}
          </p>
        )}

        {/*
          Named, since `B-069` published the vocabulary. `code` is read
          **open**: the field is a `String` on the wire and an old row may
          carry a name this build has never seen, so an unrecognised value
          falls to the general sentence rather than to an empty line.

          Outside the live region above: this list is on the screen from the
          first render, and announcing six sentences on load would bury the
          one that says how many there are.
        */}
        {placed.length > 0 && (
          <ul data-testid="review-warning-list" className="text-muted-foreground text-sm">
            {placed.map((warning, index) => {
              const sentence = t('warning', { code: warning.code ?? '' });

              return (
                <li key={`${warning.code ?? 'unknown'}-${index}`}>
                  {warning.title
                    ? t('warningAt', { warning: sentence, section: warning.title })
                    : sentence}
                </li>
              );
            })}
          </ul>
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
