'use client';

/**
 * The two things a person may say about **this** generation (`B-104`, `F-038`).
 *
 * **Closed by default, and that is the product rule rather than a layout
 * choice.** "Manual control is optional" means the default output has to be
 * usable without anyone touching anything, so a screen that opens with three
 * fields has already broken it — the reader now believes the empty ones
 * matter. Everything here is off the path until it is asked for.
 *
 * **Neither belongs to the profile, and neither belongs to the posting.**
 * That is why they are request fields:
 *
 * - `emphasize` joins the posting's own keywords and tags for one run. It is
 *   not folded into the pasted text because the analysis of a posting is
 *   cached by its hash and shared between everyone who pastes it; a directive
 *   belongs to one person and one run. The scoring formula is untouched — the
 *   same four weights read a larger set.
 * - `note` reaches Faz D and nothing else. Faz B ranks against the posting
 *   and a sentence is not a term. The prompt lets it steer wording and
 *   emphasis and forbids it to licence a claim, lengthen a line past its
 *   maximum, or change what a sentence says happened — and the validators do
 *   not read it either way, which is what makes that a promise rather than a
 *   hope.
 *
 * **The note is the person's own content**, so it travels inside the fence
 * and nothing about it reaches a log line (absolute rule 4).
 *
 * `customizationId` is the third field on that request and is **not** here:
 * it names a saved appearance set, and there is nowhere to save one yet. It
 * arrives with the screen that makes them (D12), because a picker with no
 * items is a control that teaches the reader the feature is broken.
 */

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TagInput } from '@/components/profile/TagInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** The server's own bounds, so a refused request is never sent (§ 18.7). */
export const EMPHASIZE_MAX_TERMS = 10;
export const EMPHASIZE_MAX_LENGTH = 60;
export const NOTE_MAX_LENGTH = 500;

export type DirectivesProps = {
  emphasize: string[];
  onEmphasizeChange: (terms: string[]) => void;
  note: string;
  onNoteChange: (note: string) => void;
  disabled?: boolean;
};

export function Directives({
  emphasize,
  onEmphasizeChange,
  note,
  onNoteChange,
  disabled = false,
}: DirectivesProps) {
  const t = useTranslations('Generation.directives');
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const noteId = useId();
  const noteHintId = `${noteId}-hint`;

  /*
    A button and a panel rather than `<details>`, for one reason that matters
    to a screen reader: `aria-expanded` and `aria-controls` say what the
    control does and what it owns, and a `<summary>` announces neither in a
    way that survives the styling this needs. The state is local because it is
    exactly the transient UI state Zustand is for and smaller than a store.

    Kept mounted when closed would be simpler; it is not done, because an
    unmounted panel is what makes "the default asks nothing of you" true for
    the tab order as well as for the eye.
  */
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? t('hide') : t('show')}
      </Button>

      {open && (
        <div id={panelId} className="border-border flex flex-col gap-4 rounded-md border p-4">
          <TagInput
            label={t('emphasizeLabel')}
            hint={t('emphasizeHint')}
            values={emphasize}
            onChange={onEmphasizeChange}
            maxLength={EMPHASIZE_MAX_LENGTH}
            maxCount={EMPHASIZE_MAX_TERMS}
            disabled={disabled}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor={noteId}>{t('noteLabel')}</Label>
            <p id={noteHintId} className="text-muted-foreground text-xs">
              {t('noteHint')}
            </p>
            <Textarea
              id={noteId}
              name="note"
              rows={3}
              value={note}
              disabled={disabled}
              maxLength={NOTE_MAX_LENGTH}
              aria-describedby={noteHintId}
              placeholder={t('notePlaceholder')}
              onChange={(event) => onNoteChange(event.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
