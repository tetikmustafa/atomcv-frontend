'use client';

/**
 * The confirmation itself, split from `DeleteControl` so Radix's
 * `AlertDialog` — overlay, portal, focus scope, dismissable layer — stays out
 * of the profile route's initial bundle. **9.7 KB gzipped, measured**, on a
 * screen where three of these render per section and most sessions open none.
 * Same rule and same reason as `AddSection`/`SectionForm`.
 *
 * It is controlled and has no `Trigger`: the button lives in `DeleteControl`,
 * because a trigger inside a lazily-loaded chunk would not be there to press.
 * Radix still returns focus to whatever was focused when it opened, which is
 * that button.
 *
 * **The dialog stays open until the server has answered.** Letting the action
 * close it and firing the mutation behind puts a failure nowhere — the panel
 * that would name a `412` is inside a dialog that has already gone, and the
 * row the user was looking at is unchanged with no reason given.
 */

import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';

export type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  isPending: boolean;
  error: unknown;
};

export function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending,
  error,
}: DeleteDialogProps) {
  const t = useTranslations('Editor.delete');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>

        {/* Radix warns when `Description` is missing, and it is right to — the
            dialog is described by it. Where nothing cascades there is still
            something worth saying, so this is never empty. */}
        <AlertDialogDescription>{description}</AlertDialogDescription>

        {error ? <ErrorPanel error={error} /> : null}

        <AlertDialogFooter>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              // Radix closes on click. Not until the server has answered —
              // `composeEventHandlers` skips its own handler once the default
              // is prevented, which is what makes this work.
              event.preventDefault();
              void onConfirm()
                .then(() => onOpenChange(false))
                .catch(() => {
                  // Rendered above from `error`; the dialog stays put.
                });
            }}
          >
            {isPending ? t('deleting') : confirmLabel}
          </AlertDialogAction>

          {/* After the destructive action in the DOM, so focus lands here
              first, and drawn ahead of it by the footer's reversed direction. */}
          <AlertDialogCancel disabled={isPending}>{t('cancel')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
