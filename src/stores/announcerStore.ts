import { create } from 'zustand';

export type Announcement = {
  /** Bumped on every call so repeating the same text still re-announces. */
  id: number;
  message: string;
  /** `assertive` interrupts the user. Reserve it for failures. */
  urgency: 'polite' | 'assertive';
};

type AnnouncerState = {
  announcement: Announcement | null;
  announce: (message: string, urgency?: Announcement['urgency']) => void;
  clear: () => void;
};

/**
 * Backs the app-wide `aria-live` region.
 *
 * Rule 6 exists because pipeline progress and save status are otherwise
 * conveyed by a moving bar and a coloured dot — invisible to a screen reader
 * and to anyone who cannot distinguish the colour. Both of those are the
 * *only* signal that the app is doing something, so losing them means losing
 * the state of the application entirely.
 *
 * This is transient UI state, so Zustand is the right home. Nothing from the
 * server belongs here; announce the derived sentence, not the payload.
 */
export const useAnnouncerStore = create<AnnouncerState>((set, get) => ({
  announcement: null,

  announce: (message, urgency = 'polite') =>
    set({ announcement: { id: (get().announcement?.id ?? 0) + 1, message, urgency } }),

  clear: () => set({ announcement: null }),
}));

/** Callable outside React, for announcing from a query or stream callback. */
export const announce = (message: string, urgency?: Announcement['urgency']) =>
  useAnnouncerStore.getState().announce(message, urgency);
