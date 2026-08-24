'use client';

/**
 * How much of today's allowance is left.
 *
 * Shown before the request rather than after the refusal: a limit a user only
 * meets by hitting it is a limit they experience as a failure. § 44 makes the
 * quota a product boundary, not an incident.
 *
 * Only the `generation` metric is drawn. `/account/usage` always reports both
 * — a missing entry would mean the metric does not exist, never that nothing
 * has been used (`B-039`) — but profile import is Stage 3, and a counter for
 * something the product cannot yet do is noise on the screen where the user
 * is about to do the other thing.
 *
 * It stays quiet while it loads and when it fails: this is context, and a
 * screen that leads with an error about a side note has buried what the user
 * came for.
 */

import { useTranslations } from 'next-intl';
import { useUsage } from '@/hooks/useGeneration';

export function UsageNote() {
  const t = useTranslations('Usage');
  const { data } = useUsage();

  const generation = data?.find((entry) => entry.metric === 'generation');

  if (!generation || generation.limit === undefined || generation.used === undefined) return null;

  return (
    <p data-testid="usage-note" className="text-muted-foreground text-sm">
      <span>{t('metric', { metric: generation.metric ?? 'generation' })}</span>
      {' · '}
      <span data-testid="usage-count">
        {/*
          Measured against the running backend: `used` climbs past `limit`,
          because a refused request counts too. "24 of 20" reads as a broken
          screen, and clamping the number would be a lie about what the
          server said — so past the limit the sentence changes instead of the
          number (`F-012`).
        */}
        {generation.used >= generation.limit
          ? t('none')
          : t('count', { used: generation.used, limit: generation.limit })}
      </span>
      {generation.resetsAt && (
        <>
          {' · '}
          {/*
            An absolute instant, put in the reader's own zone: the quota day
            turns at UTC midnight, which is 03:00 in Turkey (`F-007`). The date
            is shown as well as the time because a reset "at 03:00" reads as
            "soon" when it is twenty-two hours away.
          */}
          <span>{t('renews', { resetsAt: new Date(generation.resetsAt) })}</span>
        </>
      )}
    </p>
  );
}
