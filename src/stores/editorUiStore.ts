import { create } from 'zustand';

/**
 * Transient UI state for the profile editor: which sections are open, which
 * atom is focused.
 *
 * Nothing that came from the server belongs here. Profile content, atoms and
 * variants live in TanStack Query — keeping a second copy is how the two
 * drift apart.
 */
type EditorUiState = {
  expandedSectionIds: ReadonlySet<string>;
  selectedAtomId: string | null;
  toggleSection: (sectionId: string) => void;
  /**
   * Opens sections without closing any, for a screen that knows which ones
   * deserve attention — § 31.6's review, where the import said what it could
   * not settle (`B-067`).
   *
   * Additive on purpose. A `set` would fight the reader: the gate resolves
   * its warnings once, and anything opened by hand afterwards must survive
   * that answer arriving a moment late.
   */
  expandSections: (sectionIds: readonly string[]) => void;
  selectAtom: (atomId: string | null) => void;
  reset: () => void;
};

export const useEditorUiStore = create<EditorUiState>((set) => ({
  // Sections start collapsed. Bölüm 31.6: showing two hundred atoms at once
  // overwhelms; problem areas are what gets opened.
  expandedSectionIds: new Set<string>(),
  selectedAtomId: null,

  toggleSection: (sectionId) =>
    set((state) => {
      const next = new Set(state.expandedSectionIds);
      if (!next.delete(sectionId)) next.add(sectionId);
      return { expandedSectionIds: next };
    }),

  expandSections: (sectionIds) =>
    set((state) => {
      // A new Set only when something is actually added: the review resolves
      // its warnings on every render of the profile it is watching, and
      // returning a fresh Set each time would re-render every section header
      // for nothing.
      const missing = sectionIds.filter((id) => !state.expandedSectionIds.has(id));
      if (missing.length === 0) return state;

      return { expandedSectionIds: new Set([...state.expandedSectionIds, ...missing]) };
    }),

  selectAtom: (atomId) => set({ selectedAtomId: atomId }),

  reset: () => set({ expandedSectionIds: new Set<string>(), selectedAtomId: null }),
}));
