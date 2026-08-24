'use client';

/**
 * Faz F's coverage report (§ 23.3).
 *
 * **Countable facts, never a percentage.** The section forbids one by name,
 * and the reason is not modesty about the model: the measurement compares
 * skill names, so a figure to the decimal place invites the reader to treat
 * it as a hiring probability. Nothing here divides one of these numbers by
 * another — the pair is shown as a pair.
 *
 * This is the opposite of profile completeness, which *is* a percentage by
 * design. The two must not be unified.
 *
 * The missing skills are the posting's own words, not our canonical
 * spellings: the reader is looking for the term they read in the advert.
 */

import { useTranslations } from 'next-intl';
import type { FitReport as FitReportData } from '@/lib/api/endpoints/generations';

/** One skill list, drawn only when it has something in it. */
function Skills({ label, skills }: { label: string; skills: readonly string[] | undefined }) {
  if (!skills?.length) return null;

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</h3>
      {/* A list, not a sentence: these are items, and a screen reader that
          announces "list, 4 items" says something a comma-joined line cannot. */}
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {skills.map((skill) => (
          <li key={skill}>{skill}</li>
        ))}
      </ul>
    </div>
  );
}

export function FitReport({ report }: { report: FitReportData }) {
  const t = useTranslations('Fit');

  // Required first: it is the gap that costs the most to leave open, and
  // § 23.3's own example writes the sentence about one missing skill.
  const suggested = (report.missingRequired ?? [])[0] ?? (report.missingPreferred ?? [])[0];

  return (
    <section
      aria-labelledby="fit-heading"
      className="border-border flex flex-col gap-4 border-t pt-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 id="fit-heading" className="text-base font-medium">
          {t('heading')}
        </h2>
        {report.level && (
          <span data-testid="fit-level" className="text-muted-foreground text-sm">
            {t('level', { level: report.level })}
          </span>
        )}
      </div>

      {/*
        A description list rather than a table: two labelled numbers are pairs,
        and a table would promise rows and columns that do not exist.
      */}
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div className="flex gap-2">
          <dt>{t('required')}</dt>
          <dd data-testid="fit-required" className="font-medium">
            {t('count', {
              covered: report.requiredCovered ?? 0,
              total: report.requiredTotal ?? 0,
            })}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt>{t('preferred')}</dt>
          <dd data-testid="fit-preferred" className="font-medium">
            {t('count', {
              covered: report.preferredCovered ?? 0,
              total: report.preferredTotal ?? 0,
            })}
          </dd>
        </div>
      </dl>

      <Skills label={t('covered')} skills={report.coveredSkills} />
      {/*
        Two lists, not one. The counts already say how many are missing on
        each side; merging the names would leave the reader unable to tell
        which gap is the one that costs them the interview.
      */}
      <Skills label={t('missingRequired')} skills={report.missingRequired} />
      <Skills label={t('missingPreferred')} skills={report.missingPreferred} />

      {suggested && (
        <p className="text-muted-foreground text-sm">{t('suggestion', { skill: suggested })}</p>
      )}
    </section>
  );
}
