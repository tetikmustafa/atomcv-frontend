'use client';

/**
 * The one error surface (rule 7, Bölüm 35.4).
 *
 * It renders whatever the server sent and knows nothing about individual
 * codes. That is the whole design: a panel with a `switch (code)` in it grows
 * a branch per error, and the branch for the newest error is always the
 * missing one — on the screen where the user is already stuck.
 *
 * Two consequences worth stating, because both look like omissions:
 *
 * - **No action is invented.** The buttons come from `resolutions`, which the
 *   server owns. Retry and dismiss are the panel's own controls and sit
 *   outside that row, so a way forward the server did not offer is never
 *   dressed up as one it did.
 * - **A resolution we cannot name is dropped, not guessed at.** The action
 *   vocabulary is open; an unlabelled button on an error screen could do
 *   anything, and the user has no way to find out which.
 */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useErrorMessage, useResolutionLabel } from '@/hooks/useErrorMessage';
import { toErrorLike } from '@/lib/errors/errorLike';
import type { Resolution } from '@/types/domain';

export type ErrorPanelProps = {
  /** An `ApiError`, an SSE `failed` payload, a `NetworkError` — anything. */
  error: unknown;
  /** Runs the action the user picked. The panel never interprets it. */
  onResolve?: (resolution: Resolution) => void;
  /**
   * The panel's own retry, rendered apart from the resolutions. Pass it only
   * where repeating the request could genuinely differ — `isRetriable` is the
   * test, and a 4xx is not it.
   */
  onRetry?: () => void;
  onDismiss?: () => void;
};

export function ErrorPanel({ error, onResolve, onRetry, onDismiss }: ErrorPanelProps) {
  const t = useTranslations('ErrorPanel');
  const describe = useErrorMessage();
  const label = useResolutionLabel();

  const { code, params, resolutions } = toErrorLike(error);

  const offered = resolutions
    .map((resolution) => ({ resolution, text: label(resolution) }))
    .filter((entry): entry is { resolution: Resolution; text: string } => entry.text !== null);

  return (
    // `alert` rather than a live region set up in advance: this appears in
    // response to something the user just did, and it is the answer to it.
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-md border p-4 text-sm"
    >
      <p>{describe({ code, params: params ?? {} })}</p>

      {offered.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {offered.map(({ resolution, text }) => (
            <Button
              key={resolution.action}
              type="button"
              size="sm"
              onClick={() => onResolve?.(resolution)}
            >
              {text}
            </Button>
          ))}
        </div>
      )}

      {(onRetry ?? onDismiss) && (
        <div className="flex flex-wrap gap-2">
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {t('retry')}
            </Button>
          )}
          {onDismiss && (
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              {t('dismiss')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
