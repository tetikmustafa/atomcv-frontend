'use client';

/**
 * The one delete control. Section, entry, atom — the differences are the words
 * passed in, not the behaviour.
 *
 * **Nothing here is optimistic.** A delete cannot be rolled back from a
 * captured copy the way an edit can: restoring a cascaded section would mean
 * recreating a tree with the ids the server chose, and no endpoint does that.
 * The confirmation is what pays for the wait.
 *
 * The counts come from the caller, which is the only place that knows them —
 * and they are the point of the dialog. "Delete this section?" and "this also
 * removes 3 entries and 8 bullets" are different questions, and the user is
 * only in a position to answer the second one.
 *
 * This file holds the button; `DeleteDialog` holds the dialog and is loaded on
 * the first press, keeping Radix's `AlertDialog` out of the initial bundle
 * (9.7 KB gzipped, measured). Once loaded it stays mounted — a second delete
 * should not wait for a second import.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const DeleteDialog = dynamic(
  () => import('@/components/profile/DeleteDialog').then((module) => module.DeleteDialog),
  {
    // Nothing to server-render: the dialog does not exist until a click.
    ssr: false,
    loading: () => <DialogLoading />,
  },
);

function DialogLoading() {
  const t = useTranslations('Editor.delete');
  // Announced rather than drawn (rule 6). The gap between the press and the
  // dialog is short, but it is a state change with nothing else to signal it.
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {t('opening')}
    </p>
  );
}

export type DeleteControlProps = {
  /**
   * The trigger's accessible name. It has to name the thing, not the verb: a
   * screen full of buttons all called "Delete" is a list the keyboard cannot
   * be navigated by.
   */
  triggerLabel: string;
  title: string;
  /** What else goes. Falls back to the bare warning when nothing does. */
  description?: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  isPending: boolean;
  error: unknown;
  /** Clears a previous failure, so reopening does not show a stale one. */
  onReset: () => void;
};

export function DeleteControl({
  triggerLabel,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending,
  error,
  onReset,
}: DeleteControlProps) {
  const t = useTranslations('Editor.delete');
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        onClick={() => {
          // A failure from the last attempt must not greet the next opening.
          onReset();
          setLoaded(true);
          setOpen(true);
        }}
      >
        {t('trigger')}
      </Button>

      {loaded && (
        <DeleteDialog
          open={open}
          onOpenChange={(next) => {
            if (next) onReset();
            setOpen(next);
          }}
          title={title}
          description={description ?? t('permanent')}
          confirmLabel={confirmLabel}
          onConfirm={onConfirm}
          isPending={isPending}
          error={error}
        />
      )}
    </>
  );
}
