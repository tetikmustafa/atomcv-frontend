'use client';

/**
 * The heading of one entry — a job, a degree, a project — above its bullets.
 *
 * It exists because `displayOrder` on an atom is numbered **within its
 * entry**, so a section rendered as one flat list interleaves them: every
 * entry's first bullet is a 0. Three jobs then read as one shuffled job with
 * no employer anywhere on screen. The heading is what makes the grouping
 * visible, and the grouping is what makes the order mean anything.
 *
 * `h3` because the section's own title is the `h2` above it. The nesting is
 * the document outline a screen reader navigates by, so it is not decoration.
 */

import { useLocale, useTranslations } from 'next-intl';
import { formatMonthYear } from '@/lib/i18n/dates';
import type { Entry } from '@/lib/api/endpoints/profile';

export type EntryHeadingProps = { entry: Entry; id: string };

export function EntryHeading({ entry, id }: EntryHeadingProps) {
  const t = useTranslations('Editor.entry');
  const locale = useLocale();

  const start = entry.startDate ? formatMonthYear(entry.startDate, locale) : undefined;
  const end = entry.endDate ? formatMonthYear(entry.endDate, locale) : undefined;

  /*
    A missing `endDate` means the job is current (`spec/08-api.md`), and that has
    to be said in words. An en dash trailing into nothing — "Apr 2022 –" —
    reads as a truncated string rather than as "still there".
  */
  const range = start ? (end ? t('range', { start, end }) : t('rangeOngoing', { start })) : end;

  return (
    <div className="flex flex-col gap-0.5">
      <h3 id={id} className="text-sm font-medium">
        {entry.title}
      </h3>

      <p className="text-muted-foreground text-xs">
        {/*
          Joined with a separator rather than by rendering each in its own
          element: the parts are one line of context, and a screen reader
          should read them as one.
        */}
        {[entry.organization, entry.location, range].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}
