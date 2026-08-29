'use client';

/**
 * One atom: its wording and the controls that decide what selection may do
 * with it.
 *
 * Two saves, not one, because the API splits them and so does the versioning
 * (`spec/08-api.md`). `PATCH /atoms/{id}` changes controls only; text goes through the
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
import { DeleteControl } from '@/components/profile/DeleteControl';
import { ImportanceSlider } from '@/components/profile/ImportanceSlider';
import { LockToggles, type LockToggle } from '@/components/profile/LockToggles';
import { RichText } from '@/components/profile/RichText';
import { TagInput } from '@/components/profile/TagInput';
import { StaleWording } from '@/components/profile/StaleWording';
import { VariantTabs } from '@/components/profile/VariantTabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAutosave } from '@/hooks/useAutosave';
import { useAtom, useDeleteAtom, usePatchAtom, usePatchVariant } from '@/hooks/useProfile';
import { useCapabilities } from '@/hooks/useSession';
import { plainText } from '@/lib/content/plainText';
import { parseRichContent, type Run } from '@/lib/content/richContent';
import type { AtomPatch } from '@/lib/api/endpoints/profile';

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

/**
 * Short enough to be spoken as a button name, long enough to tell two bullets
 * apart. The same rule `describeAtom` applies to the move buttons.
 */
function truncate(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

/** Whether anything would be lost by replacing this content with plain text. */
function hasMarks(runs: Run[]): boolean {
  return runs.some((run) => run.m.length > 0);
}

function AtomEditorImpl({ atomId }: AtomEditorProps) {
  const t = useTranslations('Editor.atom');
  const tDelete = useTranslations('Editor.delete');
  const { data: atom, isPending, error: readError } = useAtom(atomId);
  /*
    One cache entry, two hundred observers — which is what `useQuery` on a
    shared key costs, and it is the cheaper half of the trade. Threading
    capabilities down as a prop would mean passing it through the section
    list and every entry heading, and the first component that forgot to
    forward it would silently draw a control the caller may not use.
  */
  const capabilities = useCapabilities();

  const patchAtom = usePatchAtom();
  const patchVariant = usePatchVariant();
  const remove = useDeleteAtom();

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

  // Names the delete control. The server's copy, not the draft: the button
  // should say what deleting would actually remove, and a half-typed
  // replacement is not that yet.
  const label = truncate(plainText(runs));

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
        Here rather than inside `VariantTabs`, because it belongs to the
        wording being read and not to the tab strip: an atom with one wording
        has no strip and would otherwise never say it was out of date.
      */}
      <StaleWording atomId={atomId} variant={selected} />

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
              // Only what changes. This used to resend the whole wording,
              // because `content` was required even on a write that was not
              // about content — and that request cleared the user's `tone`
              // every time (handoff B-028, fixed server-side). `tone` is
              // three-state now: omitted keeps it, `null` returns it to the
              // neutral register.
              body: { primary: true },
            })
          }
        >
          {() => wordingField}
        </VariantTabs>
      ) : (
        wordingField
      )}

      {/*
        `canEditAtomControls` (§ 35.7). Hidden rather than disabled, and the
        difference matters at this scale: a locked control repeated beside
        every one of two hundred atoms is an upsell in the middle of the
        person's own work, and § 9's promise is a **narrower** product, not a
        nagging one. Nothing is lost by their absence — manual control is
        optional by design, and the default output is the same either way.

        Closed while the session is still loading: a slider that appears and
        then vanishes can be dragged in between, and the save would be
        refused. The server enforces this regardless; the gate is UX.
      */}
      {capabilities?.canEditAtomControls === true && (
        <>
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
        </>
      )}

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

      {/*
        Last, and behind a confirmation.

        The name has to be the bullet's own text — `describeAtom` does the same
        job for the move buttons, and for the same reason: a list of two
        hundred buttons all called "Delete" cannot be navigated by keyboard.
        Its wordings go with it, so the count is said when there is more than
        one; a wording cannot be deleted on its own here anyway (the server
        refuses to remove a primary one, measured), so the atom is the unit.
      */}
      <div className="border-t pt-3">
        <DeleteControl
          triggerLabel={tDelete('atomTrigger', { text: label })}
          title={tDelete('atomTitle')}
          description={tDelete('atomCascade', { wordings: variants.length })}
          confirmLabel={tDelete('atomConfirm')}
          onConfirm={() => remove.mutateAsync(atomId)}
          isPending={remove.isPending}
          error={remove.error}
          onReset={remove.reset}
        />
      </div>
    </article>
  );
}

export const AtomEditor = memo(AtomEditorImpl);
