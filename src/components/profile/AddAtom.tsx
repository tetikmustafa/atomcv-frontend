'use client';

/**
 * Adding one atom to a group — an entry's bullets, or a section's own.
 *
 * The endpoint takes the atom and its first wording together, so this is one
 * field and one button rather than a create-then-fill dance: `AtomCreate`
 * requires `content`, and a bullet that exists with nothing in it is not a
 * state the API can even represent.
 *
 * **The button is disabled while the request is in flight, and that is the
 * whole double-submit defence.** Profile creates carry no `Idempotency-Key` —
 * that header covers the Stage 2 endpoints which start work
 * (`spec/08b-api-contract.md` § D.6.5) — and they carry no `If-Match` either, because
 * there is no version to quote for a thing that does not exist. So the server
 * will happily make two bullets out of two clicks. Nothing downstream would
 * report it as an error, and the user would find the duplicate later with no
 * idea where it came from.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateAtom } from '@/hooks/useProfile';
import { announce } from '@/stores/announcerStore';
import type { AtomCreate, Entry, Section } from '@/lib/api/endpoints/profile';

export type AddAtomProps = { section: Section; entry?: Entry };

/**
 * Which kind of atom a section holds.
 *
 * `AtomCreate.kind` is required, and the two vocabularies do not line up —
 * there are eight section kinds and five atom kinds — so something has to
 * choose. A plain map rather than any string transform (rule 11), and a
 * client-side default rather than a rule: nothing in the contract says a
 * skills section may not hold a bullet, so this picks the sensible one and
 * does not prevent anything.
 *
 * `certification` is deliberately unreachable here: no section kind means it,
 * and inventing a mapping to it would be guessing on the user's behalf.
 */
const ATOM_KIND: Record<string, AtomCreate['kind']> = {
  about: 'about_paragraph',
  skills: 'skill',
  soft_skills: 'skill',
  languages: 'language',
  education: 'bullet',
  experience: 'bullet',
  projects: 'bullet',
  custom: 'bullet',
};

export function AddAtom({ section, entry }: AddAtomProps) {
  const t = useTranslations('Editor.add');
  const create = useCreateAtom();
  const [text, setText] = useState('');

  const fieldId = `add-atom-${entry?.id ?? section.id}`;
  const trimmed = text.trim();

  function submit(event: React.FormEvent) {
    event.preventDefault();

    // `disabled` on the button is the defence that actually runs, and a test
    // pins it by removing it. This is belt-and-braces for the day someone
    // restyles that button and drops the attribute — not for the Enter key:
    // Enter inside a `<textarea>` inserts a newline rather than submitting, so
    // there is no second path here today. Change the field to a single-line
    // input and there is.
    if (!trimmed || create.isPending) return;

    create.mutate(
      {
        sectionId: section.id!,
        ...(entry ? { entryId: entry.id! } : {}),
        kind: ATOM_KIND[section.kind ?? 'custom'] ?? 'bullet',
        // The same shape a wording edit sends. Marks are not authored here —
        // the editor that can express them is not built yet — so one plain run.
        content: { runs: [{ t: trimmed, m: [] }] },
      },
      {
        onSuccess: () => {
          setText('');
          // Rule 6. The new bullet appears somewhere below, which is nothing
          // at all to a screen reader without this.
          announce(t('added'));
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Label htmlFor={fieldId}>{t('label')}</Label>

      <Textarea
        id={fieldId}
        value={text}
        rows={2}
        placeholder={t('placeholder')}
        disabled={create.isPending}
        onChange={(event) => setText(event.target.value)}
      />

      <Button type="submit" size="sm" variant="outline" disabled={!trimmed || create.isPending}>
        {create.isPending ? t('adding') : t('submit')}
      </Button>

      {/* The panel renders whatever the server said to offer. A failed create
          leaves the text in the field, so retrying is re-submitting. */}
      {create.error ? <ErrorPanel error={create.error} onRetry={() => create.reset()} /> : null}
    </form>
  );
}
