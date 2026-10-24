'use client';

/**
 * The PDF read back as text (`B-125`, concept § 10.1, § 23.2).
 *
 * The server opens every document it compiled and reads it the way an
 * applicant tracking system does: are the headings there, are the bullets
 * there, did the contact line survive, did the order hold. Until `B-125` only
 * an operator's counter saw the answer.
 *
 * **A failure here is ours, and the sentence says so.** § 23.2 reports and
 * never refuses: the page fits and is the person's document, and anything
 * this finds is a fault in the template or the fonts. So the defect copy
 * neither blames the resume nor takes it away.
 *
 * Counts as pairs, like the fit report beside it — never a percentage.
 */

import { useTranslations } from 'next-intl';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import type { AtsCheck as AtsCheckData } from '@/lib/api/endpoints/generations';

export function AtsCheck({ check }: { check: AtsCheckData }) {
  const t = useTranslations('Ats');
  const readable = check.readable === true;
  const Icon = readable ? CircleCheck : TriangleAlert;

  return (
    <section aria-labelledby="ats-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="ats-heading" className="text-base font-medium">
          {t('heading')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('intro')}</p>
      </div>

      <p data-testid="ats-verdict" className="flex items-start gap-2 text-sm">
        <Icon
          aria-hidden="true"
          className={
            readable ? 'mt-0.5 size-4 shrink-0' : 'text-destructive mt-0.5 size-4 shrink-0'
          }
        />
        <span>{readable ? t('clean') : t('defect')}</span>
      </p>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div className="flex flex-col">
          <dt className="text-muted-foreground text-xs">{t('headings')}</dt>
          <dd data-testid="ats-headings" className="font-medium">
            {t('count', {
              found: check.headingsFound ?? 0,
              expected: check.headingsExpected ?? 0,
            })}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground text-xs">{t('bullets')}</dt>
          <dd data-testid="ats-bullets" className="font-medium">
            {t('count', {
              found: check.bulletsFound ?? 0,
              expected: check.bulletsExpected ?? 0,
            })}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground text-xs">{t('contact')}</dt>
          <dd className="font-medium">{t('ok', { ok: String(check.contactReadable === true) })}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground text-xs">{t('order')}</dt>
          <dd className="font-medium">
            {t('orderOk', { ok: String(check.orderPreserved === true) })}
          </dd>
        </div>
      </dl>
    </section>
  );
}
