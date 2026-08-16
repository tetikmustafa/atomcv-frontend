'use client';

/**
 * How complete the profile is.
 *
 * **This one is a percentage on purpose**, and it is the opposite case to the
 * fit report. A fit report shows countable facts ("required skills 4/4")
 * because a percentage there would imply a precision nobody has. Completeness
 * is a proportion of a checklist the server owns, so a percentage is what it
 * actually is.
 *
 * The number is recomputed server-side on every read (D.9 · 20) — never
 * derived here, or two answers to the same question start disagreeing.
 */

import { useFormatter, useTranslations } from 'next-intl';

export type CompletenessBarProps = { value: number };

export function CompletenessBar({ value }: CompletenessBarProps) {
  const t = useTranslations('Editor.profile');
  const format = useFormatter();

  // Arrives as 0-100, and `Intl` percent expects a fraction. The same trap
  // the error catalogue hit: `style: 'percent'` on 28 renders "2,800%".
  const percent = format.number(value / 100, { style: 'percent' });

  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        // The bar is a picture of the number; this is the number itself, for
        // anyone who cannot see the picture (rule 6).
        aria-valuetext={t('completeness', { percent })}
        aria-label={t('completenessLabel')}
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
      >
        <div className="bg-primary h-full transition-all" style={{ width: `${value}%` }} />
      </div>

      <p className="text-muted-foreground text-sm">{t('completeness', { percent })}</p>
    </div>
  );
}
