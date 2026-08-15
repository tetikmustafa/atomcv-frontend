'use client';

/**
 * Field-level autosave (Bölüm 37.1–37.4).
 *
 * There is no Save button anywhere in the editor, which makes this hook the
 * thing standing between a user and losing work they believe is stored. Three
 * consequences shape everything below:
 *
 * - **A pending edit must never be dropped silently.** It survives a
 *   collapsing section (flushed on unmount) and warns before a tab closes.
 * - **The status is state, not decoration.** A dot alone is invisible to a
 *   screen reader and to anyone who cannot separate the colours, so `status`
 *   is returned for a live region to speak (rule 6, Bölüm 37.3).
 * - **A 412 is not an error to retry blindly.** It means someone else's work
 *   is on the server. Merging automatically is ruled out at this scale
 *   (Bölüm 37.4), so the hook stops and hands the choice back.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isApiError } from '@/lib/api/errors';

/**
 * What the user did. The debounce belongs to the gesture, not to the field:
 * a keystroke is one of many and worth waiting out, a toggle is the whole
 * decision and waiting only makes the app feel slow (Bölüm 37.1).
 */
export type SaveTrigger = 'text' | 'slider' | 'toggle' | 'reorder';

export const SAVE_DEBOUNCE_MS: Record<SaveTrigger, number> = {
  text: 1200,
  slider: 500,
  toggle: 0,
  reorder: 0,
};

/** Bölüm 37.3, plus `conflict`, which offers a choice rather than a retry. */
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

/** How long "saved" stays up before the field goes quiet again. */
const SAVED_VISIBLE_MS = 2000;

export type AutosaveOptions<T> = {
  /**
   * Sends the value. Must read the resource's current version itself — the
   * profile hooks take it from the cache — because a version captured when
   * this closure was created is stale by the second save, and after a
   * conflict it is stale by definition.
   */
  save: (value: T) => Promise<unknown>;
  trigger: SaveTrigger;
};

export type Autosave<T> = {
  status: SaveStatus;
  /** The failure behind `error` or `conflict`. */
  error: unknown;
  /** Whether anything is waiting to be sent or is in flight. */
  hasPending: boolean;
  /** Record an edit. Only the last value before the debounce elapses is sent. */
  change: (value: T) => void;
  /** Send whatever is pending now, skipping the debounce. */
  flush: () => void;
  /** Send the pending value again — the "keep mine" half of a conflict. */
  retry: () => void;
  /** Drop the pending value — the "take theirs" half. The caller refetches. */
  discard: () => void;
};

function isVersionConflict(error: unknown) {
  return isApiError(error) && error.code === 'VERSION_CONFLICT';
}

/**
 * States in which the user's latest edit exists only in this browser.
 *
 * `conflict` counts. It is easy to read as "handled" because it has its own
 * buttons, but until one of them is pressed the edit is exactly as unsaved as
 * a failed one — and closing the tab on it loses the same work.
 */
function hasUnsavedWork(status: SaveStatus) {
  return status === 'dirty' || status === 'saving' || status === 'error' || status === 'conflict';
}

export function useAutosave<T>({ save, trigger }: AutosaveOptions<T>): Autosave<T> {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<unknown>(null);

  // Refs rather than state: these are read inside timers and promise
  // callbacks, where a captured render's copy would already be wrong.
  const pending = useRef<{ value: T } | null>(null);
  const inFlight = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  // The caller almost always passes an inline closure, so the identity
  // changes every render. Timers fire long after that render and must reach
  // the newest one — updated in an effect, because a ref written during
  // render is a ref written twice under Strict Mode.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const clearDebounce = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
  };

  // A named function expression, so the mid-flight case below can call it
  // again without referring to the `const` it is still being assigned to.
  const run = useCallback(function attempt() {
    if (inFlight.current || !pending.current) return;

    const { value } = pending.current;
    pending.current = null;
    inFlight.current = true;
    setStatus('saving');
    setError(null);

    void saveRef
      .current(value)
      .then(() => {
        inFlight.current = false;
        if (!mounted.current) return;

        // An edit that arrived mid-flight is still unsaved. Sending it now
        // rather than reporting "saved" is the difference between the
        // indicator being true and being reassuring.
        if (pending.current) {
          attempt();
          return;
        }

        setStatus('saved');
        savedTimer.current = setTimeout(() => {
          if (mounted.current) setStatus('idle');
        }, SAVED_VISIBLE_MS);
      })
      .catch((caught: unknown) => {
        inFlight.current = false;
        if (!mounted.current) return;

        // Put the value back so retry has something to send, and so a tab
        // close still warns: the edit is not on the server.
        pending.current = { value };
        setError(caught);
        setStatus(isVersionConflict(caught) ? 'conflict' : 'error');
      });
  }, []);

  const change = useCallback(
    (value: T) => {
      pending.current = { value };
      setStatus('dirty');
      clearDebounce();

      if (savedTimer.current) clearTimeout(savedTimer.current);

      const wait = SAVE_DEBOUNCE_MS[trigger];
      if (wait === 0) {
        run();
        return;
      }

      debounceTimer.current = setTimeout(run, wait);
    },
    [run, trigger],
  );

  const flush = useCallback(() => {
    clearDebounce();
    run();
  }, [run]);

  const discard = useCallback(() => {
    clearDebounce();
    pending.current = null;
    setError(null);
    setStatus('idle');
  }, []);

  /**
   * Unmount flushes rather than cancels.
   *
   * A section collapsing or a list re-rendering must not be a way to lose a
   * sentence the user finished typing 900ms ago. The request outlives the
   * component on purpose; nothing reads its result, and the cache write in
   * the mutation is what makes the value visible again.
   */
  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      if (pending.current && !inFlight.current) {
        const { value } = pending.current;
        pending.current = null;
        void saveRef.current(value).catch(() => {
          // Nothing left to tell: the component is gone. The edit is not lost
          // silently either — the beforeunload guard covers the tab, and a
          // failed write leaves the server's older value, which the next read
          // shows honestly rather than pretending the save landed.
        });
      }
    };
  }, []);

  /** Bölüm 37.3. The browser decides the wording; we only decide when to ask. */
  useEffect(() => {
    if (!hasUnsavedWork(status)) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  return {
    status,
    error,
    // Derived from the status rather than read off the refs: a ref read
    // during render is both a lint error and a value React never re-renders
    // for. The two agree by construction — `dirty` and `saving` mean a value
    // is on its way, and a failure puts it back precisely so it stays true.
    hasPending: hasUnsavedWork(status),
    change,
    flush,
    retry: flush,
    discard,
  };
}
