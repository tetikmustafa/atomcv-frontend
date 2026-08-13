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

  selectAtom: (atomId) => set({ selectedAtomId: atomId }),

  reset: () => set({ expandedSectionIds: new Set<string>(), selectedAtomId: null }),
}));
