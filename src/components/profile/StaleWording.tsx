'use client';

/**
 * What to say about a wording whose source has moved on (§ 32.2, `B-052`).
 *
 * **The message is built from a pair, not from one flag**, and collapsing the
 * two is the mistake the section is written to prevent:
 *
 * | `stale` | `userEdited` | What it means                            |
 * |---------|--------------|------------------------------------------|
 * | `false` | —            | up to date                               |
 * | `true`  | `false`      | the source changed; this is being redone |
 * | `true`  | `true`       | the source changed, **and you wrote this** |
 *
 * Everything derived from an edited wording is marked stale, whoever wrote
 * it, because the person is entitled to know the two have diverged. Only what
 * the person did **not** write is queued: replacing somebody's own sentence
 * with a machine translation because they fixed a typo in the other language
 * is the product overwriting them silently. So the third row asks instead of
 * acting, and this is the screen that asks.
 *
 * **"Keep mine" sends nothing.** The reader dismisses the notice, the wording
 * stays stale, and the badge on the tab still says so. It comes back on a
 * reload because nothing records the dismissal — which is right rather than
 * missing: the row really is still out of date, and the only thing that was
 * dismissed was this reading of it.
 *
 * **A failed regeneration is silent too.** If the job falls over with
 * `TRANSLATION_FAILED` the wording simply stays stale, and this screen is
 * already saying the true thing. An error notice on top of it would report a
 * background job to somebody who did not start one.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { usePatchVariant } from '@/hooks/useProfile';
import type { Variant } from '@/lib/api/endpoints/profile';

export type StaleWordingProps = {
  atomId: string;
  variant: Variant;
};

export function StaleWording({ atomId, variant }: StaleWordingProps) {
  const t = useTranslations('Editor.variants');
  const patch = usePatchVariant();
  const [dismissed, setDismissed] = useState(false);

  if (!variant.stale) return null;

  // Nobody claimed this wording, so the server is already redoing it. There is
  // nothing to decide and nothing to press — saying it is being refreshed is
  // the whole of what this row is owed.
  if (!variant.userEdited) {
    return (
      <p role="status" data-testid="stale-refreshing" className="text-muted-foreground text-xs">
        {t('staleRefreshing')}
      </p>
    );
  }

  if (dismissed) return null;

  return (
    <div
      role="status"
      data-testid="stale-yours"
      className="border-border bg-muted/50 flex flex-col gap-2 rounded-md border p-3 text-xs"
    >
      <p>{t('staleYours')}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="xs"
          disabled={patch.isPending}
          onClick={() =>
            patch.mutate({
              atomId,
              variantId: variant.id!,
              /*
                `false` and only `false`. A wording becomes yours by writing
                words, never by claiming it, so `true` is refused server-side —
                which means this button has exactly one thing it can send. The
                server clears the flag and, the row being stale, queues the
                translation straight away.
              */
              body: { userEdited: false },
            })
          }
        >
          {t('staleRegenerate')}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="xs"
          // Nothing is sent. This is the reader declining, and declining is
          // not a request.
          onClick={() => setDismissed(true)}
        >
          {t('staleKeepMine')}
        </Button>
      </div>
    </div>
  );
}
