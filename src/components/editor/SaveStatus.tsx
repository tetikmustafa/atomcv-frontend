'use client';

/**
 * The per-field save indicator (Bölüm 37.3, 37.4).
 *
 * A dot and a sentence. The dot is the fast signal for people who can see it;
 * the sentence is the *only* signal for everyone else, which is why it lives
 * in a live region rather than a tooltip (rule 6). Colour never carries the
 * meaning alone — each state has its own text.
 *
 * The region is rendered on every state including idle, empty. Assistive
 * technology has to be watching a node before its content changes, so a
 * region inserted at the moment it has something to say is often not
 * announced at all.
 *
 * This is deliberately not the app-wide `Announcer`: that one region is for
 * pipeline progress, and two hundred fields writing into it would talk over
 * each other and over the generation they are competing with.
 */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { SaveStatus as Status } from '@/hooks/useAutosave';

const DOT_CLASS: Record<Status, string> = {
  idle: 'bg-transparent',
  dirty: 'bg-muted-foreground/50',
  saving: 'bg-muted-foreground',
  saved: 'bg-emerald-600',
  error: 'bg-destructive',
  conflict: 'bg-destructive',
};

export type SaveStatusProps = {
  status: Status;
  /** Re-sends the pending edit. The "keep mine" half of a conflict. */
  onRetry: () => void;
  /** Drops the pending edit and takes the server's copy. */
  onDiscard: () => void;
};

export function SaveStatus({ status, onRetry, onDiscard }: SaveStatusProps) {
  const t = useTranslations('Editor.save');

  // `dirty` says nothing. Announcing every keystroke's worth of "unsaved"
  // would make a screen reader unusable in a form built entirely of fields
  // that autosave.
  const message =
    status === 'saving'
      ? t('saving')
      : status === 'saved'
        ? t('saved')
        : status === 'error'
          ? t('failed')
          : status === 'conflict'
            ? t('conflict')
            : '';

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`inline-block size-2 shrink-0 rounded-full ${DOT_CLASS[status]}`}
      />

      <span role="status" aria-live="polite" aria-atomic="true" className="text-muted-foreground">
        {message}
      </span>

      {status === 'error' && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}

      {/*
        Bölüm 37.4: no automatic merge at this scale. The two ways out are the
        user's to pick, and neither is a resolution the server named — this is
        the editor's own affordance for one status, not a `resolutions` row.
      */}
      {status === 'conflict' && (
        <>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('keepMine')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
            {t('useTheirs')}
          </Button>
        </>
      )}
    </div>
  );
}
