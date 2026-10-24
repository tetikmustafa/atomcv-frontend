'use client';

/**
 * How much of today's allowance is left.
 *
 * Shown before the request rather than after the refusal: a limit a user only
 * meets by hitting it is a limit they experience as a failure. § 44 makes the
 * quota a product boundary, not an incident.
 *
 * **Which metric is a prop, and it used to be a constant.** `/account/usage`
 * always reports both — a missing entry would mean the metric does not exist,
 * never that nothing has been used (`B-039`) — and only `generation` was ever
 * drawn, because "profile import is Stage 3" and a counter for something the
 * product could not yet do would have been noise.
 *
 * Stage 3 closed. Import shipped, `PROFILE_QUOTA_EXCEEDED` has a sentence
 * written for it, and the counter stayed behind — so the only way to learn
 * that limit was to be refused by it, which is the failure this component
 * exists to prevent.
 *
 * It stays quiet while it loads and when it fails: this is context, and a
 * screen that leads with an error about a side note has buried what the user
 * came for.
 */

import { useTranslations } from 'next-intl';
import { useUsage } from '@/hooks/useGeneration';
import { useSession } from '@/hooks/useSession';
import type { Usage } from '@/lib/api/endpoints/account';
import type { Capabilities } from '@/lib/api/endpoints/auth';

/** The two the server counts (§ 44.2). */
export type UsageMetric = 'generation' | 'profile_extract';

export function UsageNote({ metric = 'generation' }: { metric?: UsageMetric } = {}) {
  const t = useTranslations('Usage');
  const session = useSession().data;
  // `/account/usage` is an account's endpoint and answers a guest `401` —
  // measured, on every visit to the two screens that draw this. A guest's
  // counters arrive with the session instead.
  const { data } = useUsage({ enabled: session?.authenticated === true });

  const generation =
    session && !session.authenticated
      ? fromCapabilities(session.capabilities, metric)
      : data?.find((entry) => entry.metric === metric);

  if (
    !generation ||
    generation.limit === undefined ||
    generation.used === undefined ||
    generation.remaining === undefined
  ) {
    return null;
  }

  return (
    <p data-testid={`usage-note-${metric}`} className="text-muted-foreground text-sm">
      <span>{t('metric', { metric: generation.metric ?? metric })}</span>
      {' · '}
      <span data-testid="usage-count">
        {/*
          `remaining` rather than a comparison of our own. `used` used to
          climb past `limit` because refusals were counted in it; `B-040`
          split the two, so the pair prints as it is and the server owns the
          arithmetic (`F-012`, closed).

          Nothing left still gets its own sentence: "20 of 20" is accurate and
          "None left today" is what the reader actually needs to know.
        */}
        {generation.remaining === 0
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

function fromCapabilities(capabilities: Capabilities, metric: UsageMetric): Usage {
  const [limit, used] =
    metric === 'generation'
      ? [capabilities.dailyGenerationQuota, capabilities.generationsUsedToday]
      : [capabilities.dailyProfileQuota, capabilities.profilesUsedToday];

  return {
    metric,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    ...(capabilities.quotaResetsAt ? { resetsAt: capabilities.quotaResetsAt } : {}),
  };
}
