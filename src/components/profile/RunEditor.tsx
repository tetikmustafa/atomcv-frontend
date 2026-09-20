'use client';

/**
 * Editing a wording **without losing its marks** (absolute rule 4, § 14.1).
 *
 * The gap this closes was honest about itself: plain-text editing drops every
 * mark, the atom editor warns before it happens, and the warning was "a
 * bridge, not a template". This is the component rule 4 names, loaded the way
 * rule 4 says.
 *
 * **It edits runs, not a rendered document.** A contenteditable surface would
 * mean a WYSIWYG library and a mapping between a DOM selection and a run
 * array — two sources of truth for one sentence, and the place every rich
 * editor's bugs live. The stored shape is a list of runs with marks; so is
 * this. What somebody sees is what the model holds, which is also why the
 * link invariant can be enforced where it belongs.
 *
 * **Unknown marks survive, and that is the point rather than a nicety.**
 * Forward compatibility is symmetric (EK D.9 · 2): the backend does not drop
 * a mark it does not recognise, so neither may this. A run carrying one shows
 * it, says it is not one this build knows, and writes it back untouched —
 * otherwise a newer version's markup is deleted the moment somebody fixes a
 * typo.
 *
 * **A draft may be invalid; a run may not.** `link` must carry an `href` and
 * a non-link must not (EK D.9 · 1) — `createRun` throws on both, which is
 * exactly right for content and exactly wrong for the instant after somebody
 * ticks the box. So this holds a draft that is allowed to be half-finished,
 * says so on the row, and calls `onChange` only with runs that are whole.
 * The alternative is a save refused seconds later by a server, which is the
 * shape P8 exists to prevent.
 */

import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createRun,
  isKnownMark,
  KNOWN_MARKS,
  type Mark,
  type Run,
} from '@/lib/content/richContent';

/** The one mark with a rule of its own. */
const LINK: Mark = 'link';

/**
 * A row as the reader has it, which is not yet a run: `href` may be empty
 * while the link mark is on, and that is a state the model has no word for.
 */
type Draft = { t: string; m: Mark[]; href: string };

export type RunEditorProps = {
  runs: Run[];
  /** Called only with content that is whole. */
  onChange: (runs: Run[]) => void;
  /** Names the group, since a `<label>` can only name one control. */
  labelledBy?: string;
  disabled?: boolean;
};

const toDraft = (run: Run): Draft => ({ t: run.t ?? '', m: [...run.m], href: run.href ?? '' });

const isWhole = (draft: Draft) => !draft.m.includes(LINK) || draft.href.trim() !== '';

export function RunEditor({ runs, onChange, labelledBy, disabled = false }: RunEditorProps) {
  const t = useTranslations('Editor.runs');
  const fieldId = useId();

  /*
    Seeded from the server's copy and then owned by the fields, the same rule
    `AtomEditor`'s `draft` follows: re-reading on every render would write the
    saved copy back mid-word and move the caret. Compared during render rather
    than in an effect, because an effect renders the stale value once first.

    **Compared by value, not by identity**, and that is not a refinement — it
    is the difference between working and not. `runs` is parsed out of the
    cached content on every render, so a fresh array arrives each time and an
    identity check re-seeds on every keystroke: the field takes one character
    and then snaps back to the saved sentence. Measured, not reasoned about.
  */
  const key = JSON.stringify(runs);
  const [seed, setSeed] = useState(key);
  const [drafts, setDrafts] = useState(() => runs.map(toDraft));

  if (key !== seed) {
    setSeed(key);
    setDrafts(runs.map(toDraft));
  }

  function edit(next: Draft[]) {
    setDrafts(next);

    // Nothing leaves here half-finished. `createRun` is what builds each one,
    // so the invariant is asserted by the same function the rest of the app
    // uses rather than re-stated here.
    if (!next.every(isWhole)) return;

    onChange(
      next.map((draft) =>
        draft.m.includes(LINK)
          ? createRun(draft.t, draft.m, draft.href.trim())
          : createRun(draft.t, draft.m),
      ),
    );
  }

  const change = (index: number, patch: Partial<Draft>) =>
    edit(drafts.map((draft, at) => (at === index ? { ...draft, ...patch } : draft)));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">{t('intro')}</p>

      {/*
        The **list** carries the name, not a wrapper with `role="group"`.
        An entry in the profile is a group, so a second and incidental one
        around every marked wording would blur a structural claim the editor
        makes elsewhere. A named list says the same thing about a set of parts
        and collides with nothing.
      */}
      <ul
        {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
        className="flex flex-col gap-3"
      >
        {drafts.map((draft, index) => {
          const rowId = `${fieldId}-${index}`;
          const unknown = draft.m.filter((mark) => !isKnownMark(mark));
          const needsHref = draft.m.includes(LINK) && draft.href.trim() === '';

          return (
            <li key={rowId} className="border-border flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor={`${rowId}-text`}>{t('partLabel', { number: index + 1 })}</Label>
                  <Input
                    id={`${rowId}-text`}
                    value={draft.t}
                    disabled={disabled}
                    onChange={(event) => change(index, { t: event.target.value })}
                  />
                </div>

                {/*
                  A wording needs at least one run: an empty list is content
                  with nothing in it, which the server refuses and which
                  leaves the reader nothing to type into.
                */}
                {drafts.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={disabled}
                    aria-label={t('removePart', { number: index + 1 })}
                    onClick={() => edit(drafts.filter((_draft, at) => at !== index))}
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
              </div>

              <fieldset className="flex flex-wrap items-center gap-3">
                <legend className="sr-only">{t('marksLabel', { number: index + 1 })}</legend>

                {KNOWN_MARKS.map((mark) => (
                  <label key={mark} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={draft.m.includes(mark)}
                      disabled={disabled}
                      onChange={(event) =>
                        change(index, {
                          m: event.target.checked
                            ? [...draft.m, mark]
                            : draft.m.filter((candidate) => candidate !== mark),
                          /*
                            Taking `link` off clears the address in the same
                            step. Leaving it would build a run with an href
                            and no link mark — refused by the server, and
                            refused only on save, long after the box was
                            unticked.
                          */
                          ...(mark === LINK && !event.target.checked ? { href: '' } : {}),
                        })
                      }
                    />
                    {t(`marks.${mark}`)}
                  </label>
                ))}

                {/*
                  Shown, named and untouched. There is no box for it, because
                  this build does not know what it means — and offering to
                  delete something whose meaning is unavailable is worse than
                  leaving it alone.
                */}
                {unknown.length > 0 && (
                  <span data-testid={`${rowId}-unknown`} className="text-muted-foreground text-xs">
                    {t('unknownMarks', { marks: unknown.join(', ') })}
                  </span>
                )}
              </fieldset>

              {draft.m.includes(LINK) && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${rowId}-href`}>{t('hrefLabel')}</Label>
                  <Input
                    id={`${rowId}-href`}
                    type="url"
                    value={draft.href}
                    disabled={disabled}
                    aria-invalid={needsHref ? true : undefined}
                    {...(needsHref ? { 'aria-describedby': `${rowId}-href-missing` } : {})}
                    onChange={(event) => change(index, { href: event.target.value })}
                  />
                  {/*
                    Said before the save rather than after it. A link with no
                    address is refused by the server, and the reader would
                    learn that from an error panel a beat later with the box
                    already ticked.
                  */}
                  {needsHref && (
                    <p
                      id={`${rowId}-href-missing`}
                      role="alert"
                      className="text-destructive text-xs"
                    >
                      {t('hrefMissing')}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={() => edit([...drafts, { t: '', m: [], href: '' }])}
      >
        {t('addPart')}
      </Button>
    </div>
  );
}
