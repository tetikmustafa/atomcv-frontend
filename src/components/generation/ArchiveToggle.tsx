'use client';

/**
 * Marking a resume to keep (`B-102`, § 13).
 *
 * **What the mark buys is a retention rule, and there is nothing to retain
 * yet.** An archived generation's artifact never expires; until object
 * storage lands nothing expires either way (§ 57.4). So the copy promises
 * what is true today — the mark is kept and read — rather than protection
 * from a deletion that does not happen. When the rule starts biting, the
 * sentence gets stronger; a sentence that over-promised first would have to
 * get weaker, and nobody reads a correction.
 *
 * **Drawn only for an account**, and hidden rather than disabled. `archive`
 * maps to `canSaveHistory`, which is the same answer as "are these kept at
 * all": an anonymous session's generations go with its profile, so there is
 * nothing for a keep-mark to keep. A greyed-out switch beside somebody's
 * finished resume is an upsell in the middle of their work, and § 9's promise
 * is a narrower product rather than a nagging one.
 *
 * The refusal is still handled, because a session can end while the screen is
 * open: the server answers `403 FEATURE_REQUIRES_ACCOUNT` with `sign_up`, and
 * `useAccountResolution` carries it out with `next` pointing back here.
 *
 * **Idempotent server-side**, so nothing here guards against a double press.
 * What it does guard is the state it draws from: the switch reads the
 * generation rather than a local copy, so a failed write leaves it showing
 * what the server still holds.
 */

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAccountResolution } from '@/hooks/useAccountResolution';
import { useArchiveGeneration } from '@/hooks/useGeneration';
import { useCapabilities } from '@/hooks/useSession';
import { announce } from '@/stores/announcerStore';

export type ArchiveToggleProps = {
  generationId: string;
  archived: boolean;
};

export function ArchiveToggle({ generationId, archived }: ArchiveToggleProps) {
  const t = useTranslations('Result.archive');
  const archive = useArchiveGeneration(generationId);
  const capabilities = useCapabilities();
  const { onResolve, canResolve } = useAccountResolution();
  const switchId = useId();

  // `=== true` rather than truthiness: the capabilities are undefined while
  // the session is in flight, and a control that appears and then vanishes
  // can be pressed in between.
  if (capabilities?.canSaveHistory !== true) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Switch
          id={switchId}
          checked={archived}
          disabled={archive.isPending}
          onCheckedChange={(next) =>
            archive.mutate(next, {
              // Announced rather than shown as a change of colour: the switch
              // moving is the only visual feedback, and rule 6 does not allow
              // that to be the whole of it.
              onSuccess: () => announce(t(next ? 'announceKept' : 'announceUnkept')),
            })
          }
        />
        <Label htmlFor={switchId} className="font-normal">
          {t('label')}
        </Label>
      </div>

      <p className="text-muted-foreground text-sm">{t('hint')}</p>

      {archive.error && (
        <ErrorPanel error={archive.error} onResolve={onResolve} canResolve={canResolve} />
      )}
    </div>
  );
}
