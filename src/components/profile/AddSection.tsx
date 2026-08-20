'use client';

/**
 * The way out of an empty profile.
 *
 * `GET /profile` never 404s, so a new account lands on a headline, a
 * completeness of 0 and an empty section list. Until this existed there was
 * nothing on that screen to press.
 *
 * Two jobs, deliberately kept apart: this file owns the button and the
 * open/closed state, and `SectionForm` owns the form. The split is what keeps
 * **React Hook Form and Zod out of the profile route's initial bundle** — 75 KB
 * gzipped between them, measured, which took the route's own share from 70.7
 * to 145.7 KB and broke the ceiling in `bundle-budget.json`. Rule 4, applied
 * where it pays: most sessions never open this.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const SectionForm = dynamic(
  () => import('@/components/profile/SectionForm').then((module) => module.SectionForm),
  {
    // Nothing to server-render: the form does not exist until a click.
    ssr: false,
    loading: () => <FormLoading />,
  },
);

function FormLoading() {
  const t = useTranslations('Editor.addSection');
  // Announced rather than drawn as a spinner (rule 6): the gap between the
  // click and the form is a state change with nothing else to signal it.
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {t('loadingForm')}
    </p>
  );
}

export function AddSection() {
  const t = useTranslations('Editor.addSection');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t('open')}
      </Button>
    );
  }

  return <SectionForm onDone={() => setOpen(false)} />;
}
