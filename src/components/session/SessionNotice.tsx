'use client';

/**
 * The one thing an anonymous session has to say for itself: when it ends.
 *
 * **The window slides.** § 35.7 computes `anonymousExpiresAt` from the last
 * activity rather than from when the session began, which was chosen so that
 * nobody is cut off mid-review — and copy promising a flat two hours would
 * put back the anxiety the sliding window removed. So the sentence names both
 * the moment and the fact that carrying on moves it.
 *
 * It is also why this reads the value from `useSession` and nothing else:
 * `staleTime: 0` and a refetch on window focus mean the instant shown is the
 * one the server last said, not one computed hours ago. A cached copy would
 * count down to a moment that has already moved — and would do it most
 * confidently in exactly the case that matters, the tab left open all
 * afternoon.
 *
 * Nothing is drawn while the window is comfortable. A banner the user reads
 * for two hours is a banner they stop seeing, and this one has to be read
 * once.
 */

import { useTranslations } from 'next-intl';
import { EXPIRY_NOTICE_MS, useSession } from '@/hooks/useSession';

export function SessionNotice() {
  const t = useTranslations('Session');
  const { data: session, dataUpdatedAt } = useSession();

  // No session yet, or an account: an account has no `anonymousExpiresAt` at
  // all (§ 35.7), which is the absence this reads rather than a `null`.
  const expiresAt =
    session?.authenticated === false ? session.capabilities.anonymousExpiresAt : null;
  if (!expiresAt) return null;

  const at = new Date(expiresAt);
  if (Number.isNaN(at.getTime())) return null;

  /*
    Measured against **when the answer arrived**, not against `Date.now()`.

    The lint rule that forced this was right for a better reason than purity:
    a component that reads the clock while rendering shows whatever the clock
    said at a render nobody scheduled, so the notice would appear late, early,
    or never depending on what else re-rendered the tree.

    `dataUpdatedAt` makes the window mean one thing — how much the server said
    was left, at the moment it said so — and the notice re-evaluates exactly
    when a newer answer lands, which is what the focus refetch is for. It also
    errs in the safe direction: while the person is working, their requests
    slide the TTL forward and this figure lags behind, so the notice comes
    early rather than after the session is gone.
  */
  if (at.getTime() - dataUpdatedAt > EXPIRY_NOTICE_MS) return null;

  return (
    <div
      // Polite rather than assertive: it is worth hearing, and it is never
      // urgent enough to cut across what the reader is already doing. Rule 6
      // — the notice must not be a colour on a border.
      role="status"
      aria-live="polite"
      data-testid="session-notice"
      className="border-border bg-muted/50 border-b px-8 py-3 text-sm"
    >
      <p className="mx-auto max-w-3xl">{t('expiring', { at })}</p>
    </div>
  );
}
