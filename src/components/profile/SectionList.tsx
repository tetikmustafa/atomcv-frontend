'use client';

/**
 * The profile's sections, the entries inside them, and the atoms under those.
 *
 * **Three levels, not two.** An atom either belongs to an entry — a job, a
 * degree — or hangs straight off its section, and a section can hold both.
 * This rendered the section's atoms as one flat list until the editor was
 * pointed at real data, where it was plainly wrong: `displayOrder` restarts
 * inside each entry, so three jobs came out interleaved with no employer on
 * screen anywhere. The mock had two atoms and no entries, so nothing showed
 * it. The fixture has both shapes now.
 *
 * Sections are collapsible because a full profile is far longer than a
 * screen — but collapsing must never be a way to lose an edit, which is why
 * `useAutosave` flushes on unmount rather than cancelling. That is the
 * property this component leans on hardest, and it is tested there.
 *
 * Which sections are open is transient UI state, so it lives in Zustand
 * (`editorUiStore`), not in TanStack Query and not on the server: it is not
 * the user's data, and it should not survive as though it were.
 *
 * One request per section for the atoms, not one per entry: the collection is
 * unpaginated and the grouping is a client-side `filter`, which also keeps
 * `useReorderAtoms`'s cache invalidation addressing a single key.
 */

import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { AddAtom } from '@/components/profile/AddAtom';
import { AddEntry } from '@/components/profile/AddEntry';
import { AddSection } from '@/components/profile/AddSection';
import { AtomEditor } from '@/components/profile/AtomEditor';
import { DeleteControl } from '@/components/profile/DeleteControl';
import { EntryHeading } from '@/components/profile/EntryHeading';
import { SortableList } from '@/components/profile/SortableList';
import { Button } from '@/components/ui/button';
import {
  useAtoms,
  useDeleteEntry,
  useDeleteSection,
  useEntries,
  useReorderAtoms,
  useSections,
} from '@/hooks/useProfile';
import { useEditorUiStore } from '@/stores/editorUiStore';
import { plainText } from '@/lib/content/plainText';
import { parseRichContent } from '@/lib/content/richContent';
import type { Atom, Entry, Section } from '@/lib/api/endpoints/profile';

/** Names an atom for a move button and for the drag announcements. */
function describeAtom(atom: Atom): string {
  const content = atom.variants?.[0]?.content;
  if (!content) return atom.id ?? '';

  const text = plainText(parseRichContent(content).runs);
  // Long enough to tell two bullets apart, short enough to be spoken.
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

/**
 * One sortable group of atoms — either an entry's, or the section's own.
 *
 * A group is what the reorder endpoint addresses: it takes `sectionId` plus
 * an optional `entryId` and the complete list of that group. So one
 * `SortableList` per group is not a layout choice, it is the unit the server
 * accepts.
 */
function AtomGroup({ section, entry, atoms }: { section: Section; entry?: Entry; atoms: Atom[] }) {
  const t = useTranslations('Editor.section');
  const reorder = useReorderAtoms();

  // An empty group still offers the way out of being empty. Saying "nothing
  // here yet" and stopping is how a section becomes a dead end.
  if (atoms.length === 0) {
    return (
      <>
        <p className="text-muted-foreground text-sm">{t(entry ? 'entryEmpty' : 'empty')}</p>
        <AddAtom section={section} {...(entry ? { entry } : {})} />
      </>
    );
  }

  return (
    <>
      <SortableList
        items={atoms}
        getId={(atom) => atom.id!}
        getLabel={describeAtom}
        onReorder={(ids) =>
          reorder.mutate({
            sectionId: section.id!,
            ids,
            ...(entry ? { entryId: entry.id! } : {}),
          })
        }
      >
        {(atom) => <AtomEditor atomId={atom.id!} />}
      </SortableList>

      {/* A failed reorder rolls the list back, so the panel is the only thing
          that says why it moved and then did not stay. */}
      {reorder.error ? <ErrorPanel error={reorder.error} onRetry={() => reorder.reset()} /> : null}

      <AddAtom section={section} {...(entry ? { entry } : {})} />
    </>
  );
}

/**
 * Deleting an entry, with the count of what goes with it.
 *
 * The number comes from the atoms already loaded for the section, not from a
 * request of its own — the group is a client-side filter of that one
 * collection, which is the same reason `SectionAtoms` fetches once.
 */
function DeleteEntryControl({ entry, atoms }: { entry: Entry; atoms: number }) {
  const t = useTranslations('Editor.delete');
  const remove = useDeleteEntry();

  return (
    <DeleteControl
      triggerLabel={t('entryTrigger', { title: entry.title ?? '' })}
      title={t('entryTitle', { title: entry.title ?? '' })}
      description={t('entryCascade', { atoms })}
      confirmLabel={t('entryConfirm')}
      onConfirm={() => remove.mutateAsync(entry.id!)}
      isPending={remove.isPending}
      error={remove.error}
      onReset={remove.reset}
    />
  );
}

/**
 * Deleting a section, with both counts.
 *
 * ⚠️ **The cascade is total and it is the server's** — measured: the entries
 * go, their atoms go, and the atoms hanging straight off the section go too.
 * Nothing is re-parented. So the confirmation names both numbers; a control
 * that said only "delete this section" would be describing a much smaller act
 * than the one it performs.
 *
 * Rendered inside the open panel rather than beside the section's heading
 * button, and that is deliberate: the heading is the collapse toggle, and a
 * delete sitting next to it is one mis-click away from the thing it is there
 * to make deliberate. Opening the section first also means the counts on
 * screen are the ones being confirmed.
 */
function DeleteSectionControl({
  section,
  entries,
  atoms,
}: {
  section: Section;
  entries: number;
  atoms: number;
}) {
  const t = useTranslations('Editor.delete');
  const remove = useDeleteSection();

  // One branch per real case, so every sentence is whole in both languages.
  const shape =
    entries > 0 && atoms > 0 ? 'both' : entries > 0 ? 'entries' : atoms > 0 ? 'atoms' : 'none';

  return (
    <DeleteControl
      triggerLabel={t('sectionTrigger', { title: section.title ?? '' })}
      title={t('sectionTitle', { title: section.title ?? '' })}
      description={t('sectionCascade', { shape, entries, atoms })}
      confirmLabel={t('sectionConfirm')}
      onConfirm={() => remove.mutateAsync(section.id!)}
      isPending={remove.isPending}
      error={remove.error}
      onReset={remove.reset}
    />
  );
}

function SectionAtoms({ section }: { section: Section }) {
  const t = useTranslations('Editor.section');
  const atomsQuery = useAtoms({ sectionId: section.id! });
  const entriesQuery = useEntries(section.id!);

  // Narrowed one query at a time: a combined `isPending || isPending` tells
  // TypeScript nothing about either result, and TanStack's status union is
  // what makes `data` non-optional below.
  if (atomsQuery.isPending) return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  if (atomsQuery.error) return <ErrorPanel error={atomsQuery.error} />;

  if (entriesQuery.isPending) {
    return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  }
  if (entriesQuery.error) return <ErrorPanel error={entriesQuery.error} />;

  const atoms = atomsQuery.data;
  const entries = entriesQuery.data;

  /*
    Grouped by `entryId` and **not re-sorted**.

    Sorting each group by `displayOrder` is the obvious move and it breaks the
    drop. `useReorderAtoms` updates optimistically by rearranging the cached
    array; it deliberately leaves `displayOrder` alone, because the server
    renumbers and a guess would disagree with it. Sorting on that stale number
    would therefore render the old order until the refetch landed — which
    reads as a failed drop, the exact thing the optimism is there to prevent.

    Filtering is enough and is correct either way: the response is ordered by
    `displayOrder` across the whole section, so each entry's atoms come out as
    an ordered subsequence of it.
  */
  const loose = atoms.filter((atom) => !atom.entryId);
  const empty = atoms.length === 0 && entries.length === 0;

  /*
    Which of the two shapes to offer.

    A section is either grouped into entries or flat, and the data says which:
    an atom has an `entryId` or it does not. Offering the other shape's control
    on a section that has already committed invites a mixture — loose bullets
    sitting above headed jobs — that no real profile contains and that reads as
    a rendering fault rather than a choice. So a section keeps its shape, and
    only an **empty** one is asked which it wants.
  */
  const showLoose = loose.length > 0 || empty;
  const showAddEntry = entries.length > 0 || empty;

  return (
    <div className="flex flex-col gap-5">
      {/* The section's own atoms. For a skills section this is the whole of
          it; for an experience section it is usually empty. */}
      {showLoose && <AtomGroup section={section} atoms={loose} />}

      {entries.map((entry) => {
        const headingId = `entry-${entry.id}-heading`;

        return (
          /*
            `group`, not a `section`. A bare `<section aria-labelledby>` is a
            region, and `SectionRow` already spends one of those per section —
            nesting more would bury the section landmarks under an entry for
            every job. `group` is the role for a set of related controls that
            does not belong in a page summary, which is what an entry's
            bullets are.
          */
          <div
            key={entry.id}
            role="group"
            aria-labelledby={headingId}
            className="flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <EntryHeading entry={entry} id={headingId} />
              <DeleteEntryControl
                entry={entry}
                atoms={atoms.filter((atom) => atom.entryId === entry.id).length}
              />
            </div>

            <AtomGroup
              section={section}
              entry={entry}
              atoms={atoms.filter((atom) => atom.entryId === entry.id)}
            />
          </div>
        );
      })}

      {showAddEntry && <AddEntry section={section} />}

      {/* Last in the panel, away from the controls that add things. */}
      <div className="border-t pt-3">
        <DeleteSectionControl section={section} entries={entries.length} atoms={atoms.length} />
      </div>
    </div>
  );
}

/**
 * One section. Its own component so the open/closed selector is scalar and
 * per-section: subscribing to the whole set in the parent would re-render
 * every section — and every atom editor under an open one — each time any
 * section is toggled.
 */
function SectionRow({ section }: { section: Section }) {
  const open = useEditorUiStore((state) => state.expandedSectionIds.has(section.id!));
  const toggle = useEditorUiStore((state) => state.toggleSection);
  const panelId = `section-${section.id}`;

  return (
    <section aria-labelledby={`${panelId}-heading`}>
      <h2 id={`${panelId}-heading`}>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => toggle(section.id!)}
        >
          {section.title}
        </Button>
      </h2>

      {/*
        Rendered only when open. Keeping it mounted and hidden would hold two
        hundred atom editors alive behind every collapsed section (Bölüm 37.7)
        — and each of them subscribes to a cache key.
      */}
      {open && (
        <div id={panelId} className="pt-2">
          <SectionAtoms section={section} />
        </div>
      )}
    </section>
  );
}

export function SectionList() {
  const t = useTranslations('Editor.section');
  const { data: sections, isPending, error } = useSections();

  if (isPending) return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  if (error) return <ErrorPanel error={error} />;

  return (
    <div className="flex flex-col gap-4">
      {/*
        A profile with no sections is the state a new account starts in, not an
        edge case: `GET /profile` never 404s, so the first thing anyone sees is
        an empty list. Until this said so and offered a way out, that screen
        was a headline, a completeness of 0, and nothing to do.
      */}
      {sections.length === 0 && <p className="text-muted-foreground text-sm">{t('none')}</p>}

      {sections.map((section) => (
        <SectionRow key={section.id} section={section} />
      ))}

      <AddSection />
    </div>
  );
}
