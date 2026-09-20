'use client';

/**
 * The labels an atom wears (`B-103`, § 19.1, § 55's "tag / importance / lock").
 *
 * **A scoring control, and the item says how much of one.** A quarter of Faz
 * B's raw score is the overlap between these and what the posting asks for —
 * and until `B-103` nothing wrote to `tags` or `atom_tags` at all, so that
 * quarter was structurally zero for every atom against every posting. This is
 * the missing half of the editor § 55 names.
 *
 * **`auto` and `user` are drawn differently, because they are different
 * claims.** An `auto` tag is the extraction's guess about somebody's work; a
 * `user` tag is their own decision. Rendering them alike would make a guess
 * look like a choice — and a reader who cannot tell which is which has no
 * reason to correct either.
 *
 * **Not a `TagInput`**, although it looks like one. The three lists next door
 * are fields on `AtomPatch` and are replaced whole; these are **rows**, added
 * and removed one endpoint call at a time, with an id each. Sharing the
 * control would mean either sending a whole list to an endpoint that takes
 * one label, or pretending a row-shaped thing is a field.
 *
 * **No version travels.** A tag is its own row and the atom is untouched, so
 * there is no `If-Match` to build — which also means two people tagging one
 * atom end up with both tags rather than a conflict.
 *
 * **What comes back is what is drawn.** The label is stored trimmed and
 * lowercased, because that is the form the scorer compares; echoing what was
 * typed would show a word that is not the one being scored.
 */

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAccountResolution } from '@/hooks/useAccountResolution';
import { useTagAtom, useUntagAtom } from '@/hooks/useProfile';
import type { AtomTag } from '@/lib/api/endpoints/profile';
import { announce } from '@/stores/announcerStore';

/** The catalogue's own bound, so a refused write never happens. */
export const TAG_MAX_LENGTH = 60;

export type AtomTagsProps = {
  atomId: string;
  tags: AtomTag[];
  disabled?: boolean;
};

export function AtomTags({ atomId, tags, disabled = false }: AtomTagsProps) {
  const t = useTranslations('Editor.atomTags');
  const add = useTagAtom();
  const remove = useUntagAtom();
  const { onResolve, canResolve } = useAccountResolution();

  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const label = draft.trim();
    setDraft('');

    if (label === '') return;

    /*
      Compared lowercased, because that is how the server stores it: typing
      "Data-Engineering" over an existing `data-engineering` would otherwise
      send a request whose answer is the tag already there — idempotent, so
      harmless, but a round trip for nothing and a moment where the field
      looks like it did something.

      `toLocaleLowerCase('en')` rather than the reader's locale (absolute rule
      11): a tag is a wire vocabulary, and Turkish folds `I` to a dotless `ı`.
    */
    const canonical = label.toLocaleLowerCase('en');
    if (tags.some((tag) => tag.label?.toLocaleLowerCase('en') === canonical)) return;

    add.mutate(
      { atomId, label },
      { onSuccess: (tag) => announce(t('announceAdded', { label: tag.label ?? label })) },
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // The editor is a form-shaped layout; Enter adds a tag rather than
      // submitting anything.
      event.preventDefault();
      submit();
    }
  }

  const busy = disabled || add.isPending;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{t('label')}</Label>
      <p id={hintId} className="text-muted-foreground text-xs">
        {t('hint')}
      </p>

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag.id}
              data-source={tag.source}
              className={
                tag.source === 'auto'
                  ? 'border-border text-muted-foreground flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-sm'
                  : 'bg-muted flex items-center gap-1 rounded-md px-2 py-0.5 text-sm'
              }
            >
              {/*
                The source is said in words, not only by the dashes: rule 6,
                and the distinction is the reason this control exists in two
                shapes at all. Visually hidden because the border already
                carries it for a sighted reader, and repeating it in the row
                would make a list of tags twice as long to scan.
              */}
              <span className="sr-only">{t('source', { source: tag.source ?? 'user' })}</span>
              <span>{tag.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled || remove.isPending}
                aria-label={t('remove', { label: tag.label ?? '' })}
                onClick={() =>
                  tag.id &&
                  remove.mutate(
                    { atomId, tagId: tag.id },
                    { onSuccess: () => announce(t('announceRemoved', { label: tag.label ?? '' })) },
                  )
                }
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="text"
        value={draft}
        disabled={busy}
        aria-describedby={hintId}
        maxLength={TAG_MAX_LENGTH}
        placeholder={t('placeholder')}
        className="border-border bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        // A value typed and then abandoned is still something the reader meant
        // to add, the same call `TagInput` makes.
        onBlur={submit}
      />

      {/*
        `sign_up` reaches here for the same reason it reaches the rest of the
        editor: the session can end mid-edit, and the server answers with a
        way forward rather than a bare refusal.
      */}
      {(add.error ?? remove.error) && (
        <ErrorPanel
          error={add.error ?? remove.error}
          onResolve={onResolve}
          canResolve={canResolve}
        />
      )}
    </div>
  );
}
