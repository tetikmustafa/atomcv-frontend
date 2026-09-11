'use client';

/**
 * Changing a finished resume by saying what should change (§ 24.2, `B-089`).
 *
 * **The edit applies to the selection state, never to the rendered
 * document.** That is what keeps the page limit true after twenty of them:
 * every edit goes back through the selection that made the promise. The
 * visible consequence is the one this screen has to carry — the answer is a
 * **new** generation, the old one is retired, and this leaves for the new
 * one rather than patching what is on screen. Nothing here is local UI state.
 *
 * **It costs one of the day's generations**, unlike the hand toggle next
 * door, and the sentence beside the box says so. The toggle is not drawn at
 * all yet: nothing publishes which atoms this generation weighed, so there is
 * no honest way to offer one (`F-031`).
 *
 * **"Could not understand that" is a common answer and not a fault.** The
 * server would rather do nothing than remove the wrong bullet, because the
 * reader may not notice — so the message for it names what this box can
 * actually do, or the refusal becomes a dead end.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { JobProgress } from '@/components/generation/JobProgress';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useEditByInstruction, useGenerationEdited } from '@/hooks/useGeneration';
import { INSTRUCTION_MAX_LENGTH } from '@/lib/api/endpoints/generations';
import type { Resolution } from '@/types/domain';

/**
 * The one way out this screen can act on.
 *
 * `retry` is what `EDIT_NOT_UNDERSTOOD` offers, and here it means sending the
 * same sentence again — which is worth having, because the refusal is a model
 * answer rather than a deterministic one. Everything else the server might
 * offer is dropped rather than drawn: a button that does nothing is worse
 * than one that was never there, and `GENERATION_SUPERSEDED` deliberately
 * carries no action at all.
 */
const HANDLED = ['retry'] as const;

function canResolve(action: Resolution['action']) {
  return (HANDLED as readonly string[]).includes(action);
}

export function EditRequest({ generationId }: { generationId: string }) {
  const t = useTranslations('Result');

  const [instruction, setInstruction] = useState('');
  const [job, setJob] = useState<{ jobId: string; streamUrl?: string } | null>(null);

  const edit = useEditByInstruction(generationId);
  const edited = useGenerationEdited(generationId);

  function submit(sentence = instruction) {
    const trimmed = sentence.trim();
    if (trimmed === '') return;

    edit.mutate(
      { instruction: trimmed },
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
        <h2 className="text-base font-medium">{t('editTitle')}</h2>

        <JobProgress
          jobId={job.jobId}
          {...(job.streamUrl ? { streamUrl: job.streamUrl } : {})}
          onResolve={(resolution) => {
            if (resolution.action !== 'retry') return;
            // Back to the form with the sentence still in it, then sent
            // again: a job that failed is finished, and retrying it means a
            // second request rather than a second look at the first.
            setJob(null);
            submit();
          }}
          canResolve={canResolve}
          onStartOver={() => setJob(null)}
          // The edited generation is retired the moment this lands: its own
          // status, the history that no longer lists it and the total that no
          // longer counts it are all stale (`B-088`).
          onCompleted={edited}
        />
      </section>
    );
  }

  return (
    <form
      className="border-border flex flex-col gap-3 rounded-md border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h2 className="text-base font-medium">{t('editTitle')}</h2>

      <p className="text-muted-foreground text-sm">{t('editIntro')}</p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-instruction">{t('editLabel')}</Label>
        <Textarea
          id="edit-instruction"
          name="instruction"
          rows={3}
          maxLength={INSTRUCTION_MAX_LENGTH}
          value={instruction}
          placeholder={t('editPlaceholder')}
          aria-describedby="edit-cost"
          onChange={(event) => setInstruction(event.target.value)}
        />
      </div>

      {/*
        The difference `B-089` asks to be said out loud. It is not a warning —
        nothing has gone wrong and there is nothing to acknowledge — so it
        reads as a note and sits where the reader is about to decide.
      */}
      <p id="edit-cost" className="text-muted-foreground text-sm">
        {t('editCost')}
      </p>

      {edit.error && (
        <ErrorPanel
          error={edit.error}
          onResolve={(resolution) => resolution.action === 'retry' && submit()}
          canResolve={canResolve}
        />
      )}

      <Button
        type="submit"
        variant="outline"
        className="w-fit"
        disabled={edit.isPending || instruction.trim() === ''}
      >
        {edit.isPending ? t('editSending') : t('editSubmit')}
      </Button>
    </form>
  );
}
