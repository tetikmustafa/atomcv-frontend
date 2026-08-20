'use client';

/**
 * Adding an entry — a job, a degree, a project — to a section.
 *
 * The button and its open/closed state only. The form is `EntryForm`, loaded
 * on demand, which is what keeps React Hook Form and Zod out of this route's
 * initial bundle (rule 4; see `SectionForm` for the measurement).
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { Section } from '@/lib/api/endpoints/profile';

export type AddEntryProps = { section: Section };

const EntryForm = dynamic(
  () => import('@/components/profile/EntryForm').then((module) => module.EntryForm),
  {
    ssr: false,
    loading: () => <FormLoading />,
  },
);

function FormLoading() {
  const t = useTranslations('Editor.addEntry');
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {t('loadingForm')}
    </p>
  );
}

export function AddEntry({ section }: AddEntryProps) {
  const t = useTranslations('Editor.addEntry');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t('open')}
      </Button>
    );
  }

  return <EntryForm section={section} onDone={() => setOpen(false)} />;
}
