'use client';

/**
 * The profile's sections, and the atoms inside each one.
 *
 * Sections are collapsible because a full profile is far longer than a
 * screen — but collapsing must never be a way to lose an edit, which is why
 * `useAutosave` flushes on unmount rather than cancelling. That is the
 * property this component leans on hardest, and it is tested there.
 *
 * Which sections are open is transient UI state, so it lives in Zustand
 * (`editorUiStore`), not in TanStack Query and not on the server: it is not
 * the user's data, and it should not survive as though it were.
 */

import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { AtomEditor } from '@/components/profile/AtomEditor';
import { SortableList } from '@/components/profile/SortableList';
import { Button } from '@/components/ui/button';
import { useAtoms, useReorderAtoms, useSections } from '@/hooks/useProfile';
import { useEditorUiStore } from '@/stores/editorUiStore';
import { plainText } from '@/lib/content/plainText';
import { parseRichContent } from '@/lib/content/richContent';
import type { Atom, Section } from '@/lib/api/endpoints/profile';

/** Names an atom for a move button and for the drag announcements. */
function describeAtom(atom: Atom): string {
  const content = atom.variants?.[0]?.content;
  if (!content) return atom.id ?? '';

  const text = plainText(parseRichContent(content).runs);
  // Long enough to tell two bullets apart, short enough to be spoken.
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

function SectionAtoms({ section }: { section: Section }) {
  const t = useTranslations('Editor.section');
  const { data: atoms, isPending, error } = useAtoms({ sectionId: section.id! });
  const reorder = useReorderAtoms();

  if (isPending) return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  if (error) return <ErrorPanel error={error} />;
  if (atoms.length === 0) return <p className="text-muted-foreground text-sm">{t('empty')}</p>;

  return (
    <>
      <SortableList
        items={atoms}
        getId={(atom) => atom.id!}
        getLabel={describeAtom}
        onReorder={(ids) => reorder.mutate({ sectionId: section.id!, ids })}
      >
        {(atom) => <AtomEditor atomId={atom.id!} />}
      </SortableList>

      {/* A failed reorder rolls the list back, so the panel is the only thing
          that says why it moved and then did not stay. */}
      {reorder.error ? <ErrorPanel error={reorder.error} onRetry={() => reorder.reset()} /> : null}
    </>
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
      {sections.map((section) => (
        <SectionRow key={section.id} section={section} />
      ))}
    </div>
  );
}
