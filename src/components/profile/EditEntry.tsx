'use client';

/**
 * Editing an entry that already exists — its title, where it was, the dates.
 *
 * The button and its open/closed state only; `EntryForm` is the same lazily
 * loaded component `AddEntry` opens, in its edit mode. Sharing it is not just
 * economy: the fields, the schema, the error wiring and the labels are the
 * same, and a second copy would be this form with its own bugs.
 *
 * **Why editing exists at all.** Deleting cascades — a section takes its
 * entries and their bullets with it, an entry takes its bullets — so
 * "delete and recreate" is not a way to fix a typo in a title, it is a way to
 * lose the work underneath it. Until this existed, a mistyped job title was
 * permanent unless you were willing to pay that.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { Entry, Section } from '@/lib/api/endpoints/profile';

export type EditEntryProps = { section: Section; entry: Entry };

const EntryForm = dynamic(
  () => import('@/components/profile/EntryForm').then((module) => module.EntryForm),
  {
    ssr: false,
    loading: () => <FormLoading />,
  },
);

function FormLoading() {
  const t = useTranslations('Editor.editEntry');
  // Announced rather than drawn (rule 6): the gap between the press and the
  // form is a state change with nothing else to signal it.
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {t('loadingForm')}
    </p>
  );
}

export function EditEntry({ section, entry }: EditEntryProps) {
  const t = useTranslations('Editor.editEntry');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        // Named after the entry, not the verb — a column of buttons all called
        // "Edit" is a list the keyboard cannot be navigated by. Same rule as
        // the move and delete controls.
        aria-label={t('trigger', { title: entry.title ?? '' })}
        onClick={() => setOpen(true)}
      >
        {t('open')}
      </Button>
    );
  }

  return <EntryForm section={section} entry={entry} onDone={() => setOpen(false)} />;
}
