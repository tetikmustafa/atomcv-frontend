'use client';

/**
 * This resume, entered in the application tracker (concept § 9, stage 7).
 *
 * `ApplicationCreate.generationId` was on the wire from `B-093` and no screen
 * sent it: the tracker's own form asks for a company and a position only, so a
 * row could never say which resume went — and the "open the resume" link on a
 * row, which reads that field, could never appear.
 *
 * **Prefilled, one press, never automatic.** The concept has tracking "on by
 * default"; what this does instead is fill in what the posting said (`B-124`'s
 * `roleTitle` and `companyName`) and wait for the press, because creating a
 * record of an application the person may not send is a guess about their
 * plans. Once the row exists the card says so and links to it, read from the
 * same list the tracker draws — so pressing twice cannot make two.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Briefcase } from 'lucide-react';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApplications, useCreateApplication } from '@/hooks/useApplications';
import { Link } from '@/lib/i18n/navigation';
import { announce } from '@/stores/announcerStore';

export function TrackApplication({
  generationId,
  roleTitle,
  companyName,
}: {
  generationId: string;
  roleTitle?: string | undefined;
  companyName?: string | undefined;
}) {
  const t = useTranslations('Result');
  const { data: rows } = useApplications(true);
  const create = useCreateApplication();

  const [company, setCompany] = useState(companyName ?? '');
  const [position, setPosition] = useState(roleTitle ?? '');

  const tracked = rows?.some((row) => row.generationId === generationId) ?? false;

  return (
    <Card className="gap-4">
      <div className="flex items-start gap-3">
        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Briefcase className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <CardTitle>{t('trackTitle')}</CardTitle>
          <CardDescription>{t('trackHint')}</CardDescription>
        </div>
      </div>

      {tracked ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Check className="size-4" aria-hidden="true" />
            {t('tracked')}
          </p>
          <Link href="/applications" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t('trackedLink')}
          </Link>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (create.isPending || !company.trim() || !position.trim()) return;
            create.mutate(
              { company: company.trim(), position: position.trim(), generationId },
              { onSuccess: () => announce(t('trackAnnounce')) },
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${generationId}-company`}>{t('trackCompany')}</Label>
              <Input
                id={`${generationId}-company`}
                value={company}
                maxLength={200}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${generationId}-position`}>{t('trackPosition')}</Label>
              <Input
                id={`${generationId}-position`}
                value={position}
                maxLength={200}
                onChange={(event) => setPosition(event.target.value)}
              />
            </div>
          </div>
          {create.error ? <ErrorPanel error={create.error} /> : null}
          <Button
            type="submit"
            className="w-fit"
            disabled={create.isPending || !company.trim() || !position.trim()}
          >
            {create.isPending ? t('trackSaving') : t('trackSubmit')}
          </Button>
        </form>
      )}
    </Card>
  );
}
