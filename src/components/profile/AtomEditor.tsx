'use client';

/**
 * One atom: its wording and the controls that decide what selection may do
 * with it.
 *
 * Two saves, not one, because the API splits them and so does the versioning
 * (D.9 · 17). `PATCH /atoms/{id}` changes controls only; text goes through the
 * variant endpoint, and the variant carries its own version that moves
 * independently of the atom's. Each half gets its own `useAutosave`, so a
 * slider dragged while a sentence is still settling does not cancel it.
 *
 * **Text editing is plain text, and it drops marks.** That is a real
 * limitation, stated on screen rather than discovered later: the mark-aware
 * editor is the lazily-loaded component rule 4 names and is its own task.
 * What must not happen in the meantime is silent loss (P8) — so the warning
 * appears only when the atom actually has marks to lose, and it appears
 * *before* the save, not after.
 *
 * `memo` per Bölüm 37.7: 200 of these render at once, and each one subscribes
 * to its own cache key so a neighbour's save does not re-render the list.
 */

import { memo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { SaveStatus } from '@/components/editor/SaveStatus';
import { ImportanceSlider } from '@/components/profile/ImportanceSlider';
import { LockToggles, type LockToggle } from '@/components/profile/LockToggles';
import { RichText } from '@/components/profile/RichText';
import { TagInput } from '@/components/profile/TagInput';
import { VariantTabs } from '@/components/profile/VariantTabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAutosave } from '@/hooks/useAutosave';
import { useAtom, usePatchAtom, usePatchVariant } from '@/hooks/useProfile';
import { plainText } from '@/lib/content/plainText';
import { parseRichContent, type Run } from '@/lib/content/richContent';
import type { AtomPatch, Variant } from '@/lib/api/endpoints/profile';

export type AtomEditorProps = { atomId: string };

/**
 * The three lists, with the lengths the schema declares. Copied rather than
 * derived because `openapi-typescript` emits no runtime values for
 * `maxLength` — but they are the server's numbers, and letting the field
 * enforce them means a rejected write never happens in the first place.
 */
const TAG_FIELDS = [
  { field: 'skills', maxLength: 80 },
  { field: 'metrics', maxLength: 80 },
  { field: 'properNouns', maxLength: 120 },
] as const satisfies ReadonlyArray<{ field: keyof AtomPatch & string; maxLength: number }>;

/** Whether anything would be lost by replacing this content with plain text. */
function hasMarks(runs: Run[]): boolean {
  return runs.some((run) => run.m.length > 0);
}

/** A variant's runs, stripped of anything the write body must not carry. */
function runsOf(variant: Variant): Run[] {
  return variant.content ? parseRichContent(variant.content).runs : [];
}

function AtomEditorImpl({ atomId }: AtomEditorProps) {
  const t = useTranslations('Editor.atom');
  const { data: atom, isPending, error: readError } = useAtom(atomId);

  const patchAtom = usePatchAtom();
  const patchVariant = usePatchVariant();

  const variants = atom?.variants ?? [];
  // Variants come back primary-first, so the first one is the wording used
  // when nothing more specific is asked for — the right thing to open on.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  const content = selected?.content ? parseRichContent(selected.content) : undefined;
  const runs = content?.runs ?? [];

  // Local text is seeded once and then owned by the field. Re-seeding it from
  // the cache on every render would fight the user: their own save writes the
  // server's copy back mid-sentence and the caret jumps.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? plainText(runs);

  const controls = useAutosave<AtomPatch>({
    trigger: 'toggle',
    save: (patch) => patchAtom.mutateAsync({ id: atomId, patch }),
  });

  const importance = useAutosave<AtomPatch>({
    trigger: 'slider',
    save: (patch) => patchAtom.mutateAsync({ id: atomId, patch }),
  });

  const wording = useAutosave<string>({
    trigger: 'text',
    save: (next) =>
      patchVariant.mutateAsync({
        atomId,
        variantId: selected!.id!,
        // The whole content every time — there is no partial text update.
        body: { content: { runs: [{ t: next, m: [] }] } },
      }),
  });

  if (isPending) return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  if (readError) return <ErrorPanel error={readError} />;
  if (!atom || !selected) return null;

  const failed = wording.error ?? importance.error ?? controls.error;
  const showMarkWarning = hasMarks(runs) && draft !== null;

  const wordingField = (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${atomId}-text`}>{t('text')}</Label>

      {/*
        The stored content, as it will be read. Kept visible while editing:
        it is the only place the marks are still shown, and the textarea
        below cannot represent them.
      */}
      <p className="text-muted-foreground text-sm">
        <RichText runs={runs} />
      </p>

      <Textarea
        id={`${atomId}-text`}
        value={text}
        rows={2}
        onChange={(event) => {
          setDraft(event.target.value);
          wording.change(event.target.value);
        }}
        onBlur={wording.flush}
      />

      {showMarkWarning && (
        <p role="status" className="text-muted-foreground text-xs">
          {t('marksDropped')}
        </p>
      )}

      <SaveStatus
        status={wording.status}
        onRetry={wording.retry}
        onDiscard={() => {
          wording.discard();
          // Back to the server's copy, which is what "take theirs" means.
          setDraft(null);
        }}
      />
    </div>
  );

  return (
    <article className="flex flex-col gap-4 rounded-lg border p-4" data-atom-id={atomId}>
      {/*
        One wording needs no tab strip, and today every atom has exactly one.
        Rendering tabs for a single variant would be chrome around nothing.
      */}
      {variants.length > 1 ? (
        <VariantTabs
          variants={variants}
          selectedId={selected.id!}
          onSelect={(id) => {
            // The draft belongs to the wording it was typed into. Carrying it
            // across a tab switch would write one language's sentence into
            // another's — and `useAutosave` flushes on unmount, so it would
            // actually be saved there.
            wording.flush();
            setDraft(null);
            setSelectedId(id);
          }}
          onPromote={(variant) =>
            patchVariant.mutate({
              atomId,
              variantId: variant.id!,
              // `content` is required on this endpoint even when the write is
              // only about `primary`, so the wording is resent unchanged. The
              // `If-Match` is what makes that safe: a stale copy is refused
              // rather than overwriting a newer one.
              body: { content: { runs: runsOf(variant) }, primary: true },
            })
          }
        >
          {() => wordingField}
        </VariantTabs>
      ) : (
        wordingField
      )}

      <ImportanceSlider
        value={atom.importance ?? 0}
        onChange={(value) => importance.change({ importance: value })}
      />
      <SaveStatus
        status={importance.status}
        onRetry={importance.retry}
        onDiscard={importance.discard}
      />

      <LockToggles
        values={{
          active: atom.active ?? true,
          alwaysInclude: atom.alwaysInclude ?? false,
          verbatim: atom.verbatim ?? false,
        }}
        onChange={(toggle: LockToggle, value) => controls.change({ [toggle]: value })}
      />

      {/*
        The lists the pipeline reads: `skills` is what matching scores
        against, and `metrics` and `properNouns` are what the rewrite
        validator checks a model did not lose or invent. Each patch replaces
        the whole list, which is why `TagInput` hands back the complete array.
        Grouped with the toggles on the 0ms gesture — adding a tag is one
        decision, not a stream of keystrokes.
      */}
      {TAG_FIELDS.map(({ field, maxLength }) => (
        <TagInput
          key={field}
          label={t(`${field}.label`)}
          hint={t(`${field}.hint`)}
          maxLength={maxLength}
          values={atom[field] ?? []}
          onChange={(values) => controls.change({ [field]: values })}
        />
      ))}

      <SaveStatus status={controls.status} onRetry={controls.retry} onDiscard={controls.discard} />

      {/*
        A refused save is already reported by the indicator next to the field
        it belongs to. The panel is here for what the indicator cannot say:
        the code, and the resolutions the server attached to it.
      */}
      {failed ? <ErrorPanel error={failed} /> : null}
    </article>
  );
}

export const AtomEditor = memo(AtomEditorImpl);
