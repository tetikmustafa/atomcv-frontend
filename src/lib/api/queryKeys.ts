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

/**
 * A running job, and the only server-state key the SSE stream writes into.
 *
 * The stream and `GET /jobs/{id}` describe the same thing, so they share a
 * key: the fallback poll reconciles a cache the stream has been filling
 * rather than a second copy of it. Two keys here would be two sources of
 * truth for one job, and the screen would have to decide which one is real.
 */
export const jobKeys = {
  all: ['jobs'] as const,
  status: (jobId: string) => [...jobKeys.all, jobId] as const,
};

/**
 * A finished generation, keyed by its own id rather than by the job that made
 * it: the result screen is reachable by URL, and a reload knows the
 * generation and nothing about the job.
 */
export const generationKeys = {
  all: ['generations'] as const,
  detail: (generationId: string) => [...generationKeys.all, generationId] as const,
};

export const accountKeys = {
  all: ['account'] as const,
  usage: () => [...accountKeys.all, 'usage'] as const,
};

/**
 * Who is here. One key, no parameters — there is only ever one session, and
 * the server decides which one from a cookie the client cannot read.
 *
 * Deliberately not under `accountKeys`: an anonymous caller has a session and
 * no account, and nesting it there would make "invalidate the account" also
 * throw away the thing that says whether there is one.
 */
export const sessionKeys = {
  all: ['session'] as const,
  current: () => [...sessionKeys.all] as const,
};

/**
 * Configuration rather than data, which is why it is not under `sessionKeys`.
 *
 * The provider list belongs to the deployment (§ 40.6.1), not to whoever is
 * asking: it is the same answer before and after signing in. Nesting it under
 * the session would make "re-read who is here" also re-read a list that
 * cannot have changed. (`useLogout` still drops it, because it clears the
 * whole cache rather than invalidating a subtree — that is a different
 * decision, and the right one there.)
 */
export const authKeys = {
  all: ['auth'] as const,
  providers: () => [...authKeys.all, 'providers'] as const,
};
