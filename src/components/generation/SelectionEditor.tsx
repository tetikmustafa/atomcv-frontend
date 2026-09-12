'use client';

/**
 * Keeping or dropping lines by hand (§ 24.4, `B-088` and `B-097`).
 *
 * The other half of Faz G, and the one that was drawn last: the sentence box
 * next door shipped a year's worth of behaviour before this could exist,
 * because nothing published **which atoms a generation weighed**. Drawing a
 * switch per atom in the profile would have offered buttons that answer
 * `400` — an atom this generation never weighed is refused rather than
 * ignored — so the screen waited for `GET /generations/{id}/selection`.
 *
 * Three things follow from what that endpoint says, and each is visible here:
 *
 * - **The order is the ranking.** On-page lines first, then the ones the page
 *   budget held back, in the order they competed. Nothing re-sorts when a
 *   switch moves: a list that reorders under the finger is unusable, and the
 *   order is the server's answer rather than the draft's.
 * - **The text is a snapshot** of what this resume printed, not of what the
 *   atom says now. The note says so, because the two drift the moment the
 *   profile is edited.
 * - **No score is shown**, and none is published — § 23.3's objection to a
 *   percentage holds for a number beside a bullet too.
 *
 * **It costs nothing**, unlike the sentence box: no model call and nothing off
 * the day's allowance. The answer is still a **new** generation — every edit
 * goes back through the selection state, which is what keeps the page limit
 * true — so this leaves for the new one rather than patching what is on
 * screen. Nothing here is local UI state that survives the request.
 */

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { JobProgress } from '@/components/generation/JobProgress';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useEditSelection, useGenerationEdited, useSelection } from '@/hooks/useGeneration';
import { announce } from '@/stores/announcerStore';
import type { Resolution } from '@/types/domain';

/**
 * Repeating the request is the only thing this screen can do about a failure,
 * and it is worth offering: the refusals that are about the request itself
 * (`400`, `409`) carry no resolution at all, so what reaches a button here is
 * the transient kind.
 */
const HANDLED = ['retry'] as const;

function canResolve(action: Resolution['action']) {
  return (HANDLED as readonly string[]).includes(action);
}

export function SelectionEditor({ generationId }: { generationId: string }) {
  const t = useTranslations('Result');
  const listId = useId();

  // Closed until asked for, and the query with it: a reader who never opens
  // this should not pay for a list they are not looking at.
  const [open, setOpen] = useState(false);
  const selection = useSelection(generationId, open);

  /*
    Only the switches that were **moved**, keyed by atom.

    Not a copy of the list with a boolean flipped: that would be a second
    source of truth for `onPage`, and a refetch would either overwrite the
    draft or be quietly ignored. What is drawn is the server's value unless
    this says otherwise, and what is sent is exactly this.
  */
  const [moved, setMoved] = useState<Record<string, boolean>>({});

  const [job, setJob] = useState<{ jobId: string; streamUrl?: string } | null>(null);

  const edit = useEditSelection(generationId);
  const edited = useGenerationEdited(generationId);

  const lines = selection.data?.lines ?? [];

  const changed = lines.filter(
    (line) => line.atomId !== undefined && moved[line.atomId] !== undefined,
  );

  const include = changed
    .filter((line) => moved[line.atomId as string] === true && line.onPage !== true)
    .map((line) => line.atomId as string);

  const exclude = changed
    .filter((line) => moved[line.atomId as string] === false && line.onPage === true)
    .map((line) => line.atomId as string);

  const count = include.length + exclude.length;

  function toggle(atomId: string, text: string, next: boolean) {
    setMoved((current) => ({ ...current, [atomId]: next }));
    // Rule 6: the switch is the only signal that anything happened, and a
    // switch is not announced with the line it belongs to.
    announce(next ? t('selectionOn', { line: text }) : t('selectionOff', { line: text }));
  }

  function submit() {
    if (count === 0) return;

    edit.mutate(
      {
        ...(include.length > 0 ? { include } : {}),
        ...(exclude.length > 0 ? { exclude } : {}),
      },
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

  if (job) {
    return (
      <section className="border-border flex flex-col gap-3 rounded-md border p-4">
        <h2 className="text-base font-medium">{t('selectionTitle')}</h2>

        <JobProgress
          jobId={job.jobId}
          {...(job.streamUrl ? { streamUrl: job.streamUrl } : {})}
          onResolve={(resolution) => {
            if (resolution.action !== 'retry') return;
            // A finished job is finished: retrying means sending the same
            // toggles again, which is a second request rather than a second
            // look at the first.
            setJob(null);
            submit();
          }}
          canResolve={canResolve}
          onStartOver={() => setJob(null)}
          // Retired the moment this lands, along with the history and the
          // total the deletion screen states (`B-088`).
          onCompleted={edited}
        />
      </section>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        aria-expanded={false}
        aria-controls={listId}
        onClick={() => setOpen(true)}
      >
        {t('selectionOpen')}
      </Button>
    );
  }

  return (
    <section
      id={listId}
      className="border-border flex flex-col gap-3 rounded-md border p-4"
      aria-busy={selection.isPending}
    >
      <h2 className="text-base font-medium">{t('selectionTitle')}</h2>

      <p className="text-muted-foreground text-sm">{t('selectionIntro')}</p>

      {selection.isPending && (
        <p className="text-muted-foreground text-sm">{t('selectionLoading')}</p>
      )}

      {selection.error && (
        <ErrorPanel error={selection.error} onRetry={() => void selection.refetch()} />
      )}

      {selection.data && lines.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('selectionEmpty')}</p>
      )}

      {lines.length > 0 && (
        <ul className="flex flex-col gap-3">
          {lines.map((line) => {
            const atomId = line.atomId;
            if (atomId === undefined) return null;

            const id = `${listId}-${atomId}`;
            const onPage = moved[atomId] ?? line.onPage === true;

            return (
              <li key={atomId} className="flex items-start gap-3">
                <Switch
                  id={id}
                  checked={onPage}
                  disabled={edit.isPending}
                  onCheckedChange={(next) => toggle(atomId, line.text ?? '', next)}
                />
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor={id} className="font-normal">
                    {line.text}
                  </Label>
                  {/*
                    Said in words as well as by the switch's position: rule 6,
                    and the same reason the fit report counts rather than
                    colours. It reports the **draft**, which is what the next
                    press will send.
                  */}
                  <p className="text-muted-foreground text-xs">
                    {onPage ? t('selectionOnPage') : t('selectionHeldBack')}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        The snapshot note sits with the list rather than at the top: it is
        about the lines, and it only makes sense once they are on screen.
      */}
      {lines.length > 0 && (
        <p className="text-muted-foreground text-xs">{t('selectionSnapshot')}</p>
      )}

      <p id={`${listId}-cost`} className="text-muted-foreground text-sm">
        {t('selectionCost')}
      </p>

      {edit.error && (
        <ErrorPanel error={edit.error} onResolve={() => submit()} canResolve={canResolve} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          aria-describedby={`${listId}-cost`}
          disabled={edit.isPending || count === 0}
          onClick={submit}
        >
          {edit.isPending ? t('selectionSending') : t('selectionSubmit')}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          disabled={edit.isPending}
          onClick={() => {
            setOpen(false);
            setMoved({});
          }}
        >
          {t('selectionClose')}
        </Button>

        <p data-testid="selection-changed" className="text-muted-foreground text-sm">
          {t('selectionChanged', { count })}
        </p>
      </div>
    </section>
  );
}
