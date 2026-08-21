'use client';

/**
 * Renaming a section, or changing what kind it is.
 *
 * The button and its open/closed state only; `SectionForm` is the same lazily
 * loaded component `AddSection` opens, in its edit mode.
 *
 * **`kind` is editable here and that is not cosmetic.** It decides what a
 * bullet under the section is called when one is added (`AddAtom`'s map), so a
 * section created as `custom` by mistake keeps producing the wrong kind of
 * atom until it is corrected. The alternative — delete and recreate — takes
 * every entry and bullet underneath with it.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { Section } from '@/lib/api/endpoints/profile';

export type EditSectionProps = { section: Section };

const SectionForm = dynamic(
  () => import('@/components/profile/SectionForm').then((module) => module.SectionForm),
  {
    ssr: false,
    loading: () => <FormLoading />,
  },
);

function FormLoading() {
  const t = useTranslations('Editor.editSection');
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {t('loadingForm')}
    </p>
  );
}

export function EditSection({ section }: EditSectionProps) {
  const t = useTranslations('Editor.editSection');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t('trigger', { title: section.title ?? '' })}
        onClick={() => setOpen(true)}
      >
        {t('open')}
      </Button>
    );
  }

  return <SectionForm section={section} onDone={() => setOpen(false)} />;
}
