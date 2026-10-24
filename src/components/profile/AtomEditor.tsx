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
import dynamic from 'next/dynamic';
import { useFormatter, useTranslations } from 'next-intl';
import { SlidersHorizontal } from 'lucide-react';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { SaveStatus } from '@/components/editor/SaveStatus';
import { DeleteControl } from '@/components/profile/DeleteControl';
import { ImportanceSlider } from '@/components/profile/ImportanceSlider';
import { LockToggles, VerifiedToggle, type LockToggle } from '@/components/profile/LockToggles';
import { RichText } from '@/components/profile/RichText';
import { TagInput } from '@/components/profile/TagInput';
import { StaleWording } from '@/components/profile/StaleWording';
import { TranslatedWording } from '@/components/profile/TranslatedWording';
import { AddWording } from '@/components/profile/AddWording';
import { AtomTags } from '@/components/profile/AtomTags';
import { VariantTabs } from '@/components/profile/VariantTabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAccountResolution } from '@/hooks/useAccountResolution';
import { useAutosave } from '@/hooks/useAutosave';
import {
  useAtom,
  useDeleteAtom,
  useDeleteVariant,
  usePatchAtom,
  usePatchVariant,
  useProfile,
} from '@/hooks/useProfile';
import { useCapabilities } from '@/hooks/useSession';
import { plainText } from '@/lib/content/plainText';
import { createRun, parseRichContent, toContentPayload, type Run } from '@/lib/content/richContent';
import type { AtomPatch, Variant } from '@/lib/api/endpoints/profile';

type VariantTone = NonNullable<Variant['tone']>;

export type AtomEditorProps = { atomId: string };

/**
 * The mark-aware editor, loaded only when a wording with marks is opened
 * (rule 4, § 36.3). It was imported statically while a comment below said it
 * was lazy — so every profile paid for it, although most atoms have no marks
 * and most sessions never open one that does.
 */
const RunEditor = dynamic(
  () => import('@/components/profile/RunEditor').then((module) => module.RunEditor),
  { ssr: false, loading: () => <Skeleton className="h-16 w-full" /> },
);

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
  const tv = useTranslations('Editor.variants');
  const format = useFormatter();
  const { data: atom, isPending, error: readError } = useAtom(atomId);
  /*
    One cache entry, two hundred observers — which is what `useQuery` on a
    shared key costs, and it is the cheaper half of the trade. Threading
    capabilities down as a prop would mean passing it through the section
    list and every entry heading, and the first component that forgot to
    forward it would silently draw a control the caller may not use.
  */
  const capabilities = useCapabilities();
  /*
    The way out of § 35.7.2's three refusals (`B-081`). The gates below mean
    an anonymous reader should never reach one — but a session that ran out
    mid-edit lands here, and so would a control this file forgot to close.
    Without it the panel drew the server's `sign_up` button and nothing
    happened when it was pressed.
  */
  const account = useAccountResolution();

  const patchAtom = usePatchAtom();
  const patchVariant = usePatchVariant();
  // The content-language axis lives on the head, and every atom reads the
  // same cached copy of it (Bölüm 38.1).
  const { data: profile } = useProfile();
  const remove = useDeleteAtom();
  const removeVariant = useDeleteVariant();

  const variants = atom?.variants ?? [];
  // Variants come back primary-first, so the first one is the wording used
  // when nothing more specific is asked for — the right thing to open on.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * Whether the controls are open. Closed by default, and that is the point:
   * an open section of two hundred atoms used to draw two hundred sliders,
   * six switches and three tag fields apiece, so the profile read as a form
   * rather than as a CV. The wording — the content — stays on screen; what
   * the controls say is summarised beside it, so nothing is hidden unseen.
   */
  const [expanded, setExpanded] = useState(false);
  /**
   * Whether the run editor is open, for a wording that has marks.
   *
   * Closed by default for the reason the controls are: an imported CV marks
   * nearly every line — a technology, a number — so every atom used to open
   * straight into the run editor, five fields and twenty-five checkboxes for
   * one sentence, and a section of four bullets ran to four screens. Read as
   * the sentence it is until somebody asks to change it.
   */
  const [editingRuns, setEditingRuns] = useState(false);
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

  /*
    Runs rather than a string, since D13.

    It carried a string while the only editor was a textarea, and the
    conversion to a single unmarked run lived at the save. That put the marks'
    fate in the save path: every write went out as one bare run, and a marked
    wording lost its marks whichever editor had produced the text. The
    conversion belongs to the **editor** that cannot represent them, which is
    where it is now.
  */
  const wording = useAutosave<Run[]>({
    trigger: 'text',
    save: (next) =>
      patchVariant.mutateAsync({
        atomId,
        variantId: selected!.id!,
        // The whole content every time — there is no partial text update.
        body: { content: toContentPayload(next) },
      }),
  });

  if (isPending) return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  if (readError) return <ErrorPanel error={readError} />;
  if (!atom || !selected) return null;

  const failed = wording.error ?? importance.error ?? controls.error;
  /*
    Whether this wording has anything a plain-text field would destroy. It
    used to gate a warning; it now chooses the editor, which is the same
    question answered by doing the right thing instead of apologising.
  */
  const marked = hasMarks(runs);

  const wordingField = (
    <div className="flex flex-col gap-2">
      {/*
        A `<label>` names one control, and the run editor is a group of them.
        So the marked case gets a heading that labels the group instead —
        pointing `htmlFor` at a field that is not drawn is a label attached to
        nothing, which a screen reader reports as an orphan and a test finds
        before a person does.
      */}
      {marked ? (
        /*
          A `<span>`, not a heading. `aria-labelledby` works with any element,
          and an `<h3>` here would put one heading per marked atom into the
          document outline — two hundred of them under the section's own,
          which is exactly the navigation § 39.2 lists landmarks to fix rather
          than a use of them.
        */
        // Read aloud always, drawn only while the parts are open: closed, the
        // card is the sentence, and a "Text" heading over every bullet in a
        // section was a label repeated down the page.
        <span
          id={`${atomId}-text-label`}
          className={editingRuns ? 'text-sm font-medium' : 'sr-only'}
        >
          {t('text')}
        </span>
      ) : (
        <Label htmlFor={`${atomId}-text`}>{t('text')}</Label>
      )}

      {/*
        Here rather than inside `VariantTabs`, because it belongs to the
        wording being read and not to the tab strip: an atom with one wording
        has no strip and would otherwise never say it was out of date.
      */}
      <StaleWording atomId={atomId} variant={selected} />

      {/*
        And the other thing that can be true about a wording nobody typed
        (`B-107`): it may be perfectly up to date and still be a machine
        translation. The two notes are separate because they are separate
        facts — one is about the source having moved, the other about who
        wrote this line — and an atom can carry either, both or neither.
      */}
      <TranslatedWording variant={selected} />

      {/*
        The stored content, as it will be read — the whole of a marked
        wording until its editor is opened, and its preview while it is: the
        only place the marks are drawn as marks. An unmarked wording needs no
        preview, since its field already shows every character it holds.
      */}
      {marked && (
        <div className="flex items-start gap-3">
          <p
            data-testid="wording-preview"
            className={cn(
              'min-w-0 flex-1',
              editingRuns ? 'text-muted-foreground text-sm' : 'text-sm leading-relaxed',
            )}
          >
            <RichText runs={runs} />
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={editingRuns}
            aria-label={t(editingRuns ? 'textEditDone' : 'textEditOpen', { text: label })}
            onClick={() => setEditingRuns((open) => !open)}
          >
            {t(editingRuns ? 'textEditDoneShort' : 'textEditOpenShort')}
          </Button>
        </div>
      )}

      {/*
        Two editors, and which one is drawn is decided by the **content**
        rather than by a preference (D13, rule 4).

        Plain text is right for a sentence with no marks in it: it is one
        field, it types like a field, and building a run list around a single
        unmarked run would be ceremony. It is wrong the moment a mark exists,
        because saving through it deletes the mark -- which is what the
        warning under it used to be for.

        So a marked wording gets `RunEditor`, which is lazily loaded: most
        atoms have no marks, and most sessions never open one that does.
      */}
      {marked ? (
        editingRuns && (
          <RunEditor
            runs={runs}
            labelledBy={`${atomId}-text-label`}
            disabled={wording.status === 'saving'}
            onChange={(next) => {
              setDraft(null);
              wording.change(next);
            }}
          />
        )
      ) : (
        <Textarea
          id={`${atomId}-text`}
          value={text}
          rows={2}
          onChange={(event) => {
            setDraft(event.target.value);
            wording.change([createRun(event.target.value)]);
          }}
          onBlur={wording.flush}
        />
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

  const flags = [
    atom.active === false ? t('inactive') : null,
    atom.alwaysInclude ? t('alwaysInclude.label') : null,
    atom.verbatim ? t('verbatim.label') : null,
  ].filter((flag): flag is string => flag !== null);
  const detailsId = `${atomId}-details`;

  return (
    <article
      className="bg-card flex flex-col gap-3 rounded-lg border p-3 sm:p-4"
      data-atom-id={atomId}
    >
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
          /*
            D13, and the gap it closes had a stale reason: "the thing being
            deleted is the item". True of the usual case, and never true of an
            atom with two wordings — removing the Turkish one is an ordinary
            thing to want, the endpoint and its two refusals were already
            written, and only the button was missing.

            `onDelete` selects the wording that was open, so the next render
            falls back to the primary: `selected` is `find(selectedId) ??
            variants[0]`, and the id it was holding is gone.
          */
          onDelete={(variant) =>
            removeVariant.mutateAsync({ atomId, variantId: variant.id! }).then(() => {
              // The draft belonged to the wording that is gone. Left in place
              // it would be written into whichever one opens next, which is
              // the same mistake a tab switch avoids.
              setDraft(null);
              setSelectedId(null);
            })
          }
          deleting={removeVariant.isPending}
          deleteError={removeVariant.error}
          onDeleteReset={removeVariant.reset}
        >
          {() => wordingField}
        </VariantTabs>
      ) : (
        wordingField
      )}

      {/*
        What the hidden controls say, in words (rule 6): a reader who never
        opens the details still sees that an item is locked or unused. Then the
        two things done to an item as a whole — opening it, deleting it.
      */}
      <div className="flex flex-wrap items-center gap-1.5">
        {atom.source && atom.source !== 'manual' && (
          <Badge variant="muted">{t('source', { source: atom.source })}</Badge>
        )}
        {atom.verified && <Badge variant="outline">{t('verified')}</Badge>}
        {capabilities?.canEditAtomControls === true && (
          <Badge variant="outline">
            {t('importanceValue', {
              value: format.number(atom.importance ?? 0, { maximumFractionDigits: 2 }),
            })}
          </Badge>
        )}
        {flags.map((flag) => (
          <Badge key={flag} variant="secondary">
            {flag}
          </Badge>
        ))}
        {(atom.skills?.length ?? 0) > 0 && (
          <Badge variant="muted">{t('tagCount', { count: atom.skills!.length })}</Badge>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={t(expanded ? 'detailsHide' : 'detailsShow', { text: label })}
            onClick={() => setExpanded((open) => !open)}
          >
            <SlidersHorizontal aria-hidden="true" />
            {t('details')}
          </Button>
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
      </div>

      {expanded && (
        <div
          id={detailsId}
          className="bg-muted/40 flex flex-col gap-4 rounded-lg border p-3 sm:p-4"
        >
          {/*
            The register of the wording on screen (`VariantPatch.tone`). It
            could be read off a tab and set nowhere: `tone` reached the editor
            only as text in a tab label. Behind the same capability as a second
            wording, because a register only means something next to another.
          */}
          {capabilities?.canAddAlternatives === true && selected?.id && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${atomId}-tone`}>{tv('editTone')}</Label>
              <NativeSelect
                id={`${atomId}-tone`}
                value={selected.tone ?? ''}
                disabled={patchVariant.isPending}
                onChange={(event) =>
                  patchVariant.mutate({
                    atomId,
                    variantId: selected.id!,
                    // `null` returns it to the neutral register; omitted would
                    // leave it alone.
                    body: { tone: (event.target.value || null) as VariantTone | null },
                  })
                }
              >
                {(['', 'formal', 'casual', 'technical'] as const).map((register) => (
                  <option key={register || 'neutral'} value={register}>
                    {tv('tone', { tone: register || 'neutral' })}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          {/*
            `B-081`'s second item, and the reason it waited: the endpoint existed
            from Stage 1 and nothing called it, so `canAddAlternatives` was a
            capability with no control behind it.

            Placed after the wording rather than inside the tab strip — an atom
            with one wording has no strip, and that is precisely the atom somebody
            wants to add a second wording to. Switching to the new tab is the
            whole point of the callback: what was just written should be what is
            on screen.
          */}
          <AddWording
            atomId={atomId}
            variants={variants}
            languages={profile?.data.enabledLanguages ?? []}
            onAdded={(variantId) => {
              // The same flush a tab switch does, for the same reason: an
              // unsaved draft belongs to the wording it was typed into, and
              // `useAutosave` flushes on unmount into whichever is selected.
              wording.flush();
              setDraft(null);
              setSelectedId(variantId);
            }}
          />

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
              <div className="flex flex-col gap-1">
                <ImportanceSlider
                  value={atom.importance ?? 0}
                  onChange={(value) => importance.change({ importance: value })}
                />
                <SaveStatus
                  status={importance.status}
                  onRetry={importance.retry}
                  onDiscard={importance.discard}
                />
              </div>

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
            Outside the account gate: the server treats `verified` as a fact
            about the content, not a selection control, and accepts it from a
            guest. It weighs 15% of the general-mode score (§ 19.4), so in a
            resume made without a posting an item the person has confirmed
            ranks above one nobody has looked at; a posting-driven run does
            not read it, and the hint says only what is true of both.
          */}
          <VerifiedToggle
            checked={atom.verified === true}
            onChange={(value) => controls.change({ verified: value })}
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

          <SaveStatus
            status={controls.status}
            onRetry={controls.retry}
            onDiscard={controls.discard}
          />

          {/*
            The labels, and they are **not** one of the lists above (`B-103`).
            Those are fields on `AtomPatch` and get replaced whole; a tag is a row
            with an id, added and removed one call at a time and carrying who put
            it there. It also has its own error surface, because it has its own
            request — the save indicator above belongs to the patch.

            Drawn for everybody. The lists next to it are, and `atom_controls` —
            the one capability that closes controls here — names importance,
            availability and the two locks. A tag is neither: it is how somebody
            says what their own work was about, and a quarter of the raw score
            reads it.
          */}
          <AtomTags atomId={atomId} tags={atom.tags ?? []} />
        </div>
      )}

      {/*
        A refused save is already reported by the indicator next to the field
        it belongs to. The panel is here for what the indicator cannot say:
        the code, and the resolutions the server attached to it.
      */}
      {failed ? (
        <ErrorPanel error={failed} onResolve={account.onResolve} canResolve={account.canResolve} />
      ) : null}
    </article>
  );
}

export const AtomEditor = memo(AtomEditorImpl);
