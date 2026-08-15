/**
 * Query keys, in one place.
 *
 * The shape matters more than it looks. `profileKeys.all` is a prefix of
 * every other key, so invalidating it invalidates the whole subtree — which
 * is right after a destructive change and wrong after editing one atom. The
 * per-atom keys exist precisely so a single edit does not take 200 atoms
 * with it (Bölüm 37.7).
 */

export const profileKeys = {
  all: ['profile'] as const,

  /** The head: headline, contact, preferences, completeness. */
  head: () => [...profileKeys.all, 'head'] as const,

  sections: () => [...profileKeys.all, 'sections'] as const,

  entries: (sectionId?: string) =>
    sectionId
      ? ([...profileKeys.all, 'entries', { sectionId }] as const)
      : ([...profileKeys.all, 'entries'] as const),

  /** The collection. Also the only source of per-atom versions. */
  atoms: (filter: { sectionId?: string; entryId?: string } = {}) =>
    filter.sectionId || filter.entryId
      ? ([...profileKeys.all, 'atoms', filter] as const)
      : ([...profileKeys.all, 'atoms'] as const),

  /**
   * One atom, seeded from a collection response rather than fetched — the
   * API has no single-atom endpoint.
   */
  atom: (id: string) => [...profileKeys.all, 'atom', id] as const,
};
