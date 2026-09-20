'use client';

/**
 * The three string lists an atom carries: `skills`, `metrics`, `properNouns`.
 *
 * They are not decoration. `metrics` and `properNouns` are what the rewrite
 * validator checks a model did not lose or invent, and `skills` is what
 * matching scores against — so this is a field where a typo has consequences
 * a user will never see directly.
 *
 * `AtomPatch` replaces each list whole, so every edit sends the complete
 * array. There is no add/remove endpoint and there should not be one: a
 * partial list is the same trap as a partial reorder.
 */

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export type TagInputProps = {
  label: string;
  /** Explains what the list is for; the names alone do not. */
  hint: string;
  values: string[];
  onChange: (values: string[]) => void;
  /** The catalogue's limit for this field, so a rejected write never happens. */
  maxLength: number;
  /**
   * How many entries the field takes, where the server caps it — `emphasize`
   * is at most ten (`B-104`). Absent means no cap, which is the profile's
   * three lists: they are bounded by `AtomPatch`'s own validation rather than
   * by a count.
   *
   * At the cap the field is **disabled and says so** rather than swallowing
   * the eleventh entry. P8: a control that accepts a value and drops it
   * teaches the reader the list is wrong, one entry at a time.
   */
  maxCount?: number;
  disabled?: boolean;
};

export function TagInput({
  label,
  hint,
  values,
  onChange,
  maxLength,
  maxCount,
  disabled = false,
}: TagInputProps) {
  const t = useTranslations('Editor.tags');
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const full = maxCount !== undefined && values.length >= maxCount;

  function add() {
    const value = draft.trim();
    // Duplicates would be sent, stored and scored twice. Silently ignoring one
    // is right here: the user asked for it to be in the list, and it is.
    if (!value || values.includes(value)) {
      setDraft('');
      return;
    }

    // Unreachable through the input, which is disabled at the cap — but
    // `onBlur` fires on the way there, so the draft has to be dropped rather
    // than appended past the limit.
    if (full) {
      setDraft('');
      return;
    }

    onChange([...values, value.slice(0, maxLength)]);
    setDraft('');
  }

  function remove(value: string) {
    onChange(values.filter((candidate) => candidate !== value));
    // Focus would otherwise land on `body` when the button it was on is
    // removed, which loses a keyboard user's place in the form entirely.
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // The field lives inside a form-shaped layout; Enter must add a tag
      // rather than submit anything.
      event.preventDefault();
      add();
      return;
    }

    // Backspace on an empty field removes the last tag — the convention every
    // tag field has, and the only way to undo a mistyped entry without
    // reaching for the mouse.
    if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      event.preventDefault();
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <p id={hintId} className="text-muted-foreground text-xs">
        {hint}
      </p>

      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li
              key={value}
              className="bg-muted flex items-center gap-1 rounded-md px-2 py-0.5 text-sm"
            >
              <span>{value}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                aria-label={t('remove', { value })}
                onClick={() => remove(value)}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {full && (
        // `status` rather than nothing: the field disables under the reader's
        // fingers, and a control that stops accepting input without saying
        // why reads as broken.
        <p role="status" className="text-muted-foreground text-xs">
          {t('full', { max: maxCount })}
        </p>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="text"
        value={draft}
        disabled={disabled || full}
        aria-describedby={hintId}
        maxLength={maxLength}
        placeholder={t('placeholder')}
        className="border-border bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        // A value typed and then abandoned is still something the user meant
        // to add; committing it on blur is kinder than discarding it.
        onBlur={add}
      />
    </div>
  );
}
