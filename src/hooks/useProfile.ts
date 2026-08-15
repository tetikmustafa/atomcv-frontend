'use client';

/**
 * Reads of the profile. Writes live in `useAtomMutations`; autosave, with its
 * debounces and its conflict dialog, is `useAutosave` and is built on these.
 *
 * The one non-obvious thing here is atom caching. There is no
 * `GET /profile/atoms/{id}` (EK D.6), so the collection response is the only
 * place a per-atom `version` ever comes from, and an `If-Match` cannot be
 * built without one. Two bad answers follow if that is ignored: refetch the
 * whole collection after every edit — 200 atoms to learn one version — or
 * issue N requests to seed N versions, which the contract deliberately does
 * not allow. So the collection seeds the per-atom cache as it lands, and
 * writes update both caches in place.
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { profileKeys } from '@/lib/api/queryKeys';
import type { Version } from '@/lib/api/etag';
import {
  getProfile,
  listAtoms,
  listEntries,
  listSections,
  patchAtom,
  patchVariant,
  type Atom,
  type AtomPatch,
  type VariantWrite,
} from '@/lib/api/endpoints/profile';

export type AtomFilter = { sectionId?: string; entryId?: string };

/** Matches every cached atom collection, filtered or not. */
const ATOM_COLLECTIONS = [...profileKeys.all, 'atoms'];

/**
 * Writes each atom into its own cache entry.
 *
 * Called from the collection's `queryFn` rather than an effect, so the per-atom
 * entries exist by the time anything renders. `setQueryData` on an unchanged
 * atom is cheap: React Query keeps the previous reference when the value is
 * structurally equal, so this does not re-render every row on a refetch.
 */
function seedAtomCache(client: QueryClient, atoms: Atom[]) {
  for (const atom of atoms) {
    if (atom.id) client.setQueryData(profileKeys.atom(atom.id), atom);
  }
}

/**
 * The profile head and the version a write to it must quote.
 *
 * `version` is the `ETag`, because `Profile` carries no version field. Never
 * answers 404 — an account without a profile gets an empty one (D.9 · 13),
 * so there is no empty state to branch on, only `completeness: 0`.
 */
export function useProfile() {
  return useQuery({
    queryKey: profileKeys.head(),
    queryFn: () => getProfile(),
  });
}

export function useSections() {
  return useQuery({
    queryKey: profileKeys.sections(),
    queryFn: () => listSections(),
  });
}

export function useEntries(sectionId?: string) {
  return useQuery({
    queryKey: profileKeys.entries(sectionId),
    queryFn: () => listEntries(sectionId),
  });
}

/** Fetches the collection and seeds the per-atom cache from it. */
export function useAtoms(filter: AtomFilter = {}) {
  const client = useQueryClient();

  return useQuery({
    queryKey: profileKeys.atoms(filter),
    queryFn: async () => {
      const atoms = await listAtoms(filter);
      seedAtomCache(client, atoms);
      return atoms;
    },
  });
}

/**
 * One atom, from the seeded cache.
 *
 * The `queryFn` is a diagnostic, not a fetch: there is no endpoint it could
 * call. Reaching it means a component asked for an atom before any collection
 * was loaded, which is a wiring bug and should say so rather than hang on a
 * request that cannot be made.
 */
export function useAtom(id: string) {
  // Annotated, because a `queryFn` that only throws infers `never` and the
  // seeded value is what callers actually read.
  return useQuery<Atom>({
    queryKey: profileKeys.atom(id),
    queryFn: (): Atom => {
      throw new Error(
        `Atom ${id} is not in the cache and cannot be fetched: the API has no ` +
          'single-atom endpoint. Load a collection with useAtoms() first — that ' +
          'is what seeds this entry, and its per-item version is what a write needs.',
      );
    },
    // The value only ever changes through a write, which updates the cache
    // directly. Refetching would run the throw above.
    staleTime: Infinity,
    retry: false,
  });
}

/* --------------------------------- writes ------------------------------ */

/**
 * Puts a server-returned atom into both caches.
 *
 * Both, because they are read by different components and there is no
 * endpoint that could reconcile them: invalidating the collection to pick up
 * one changed atom refetches all of them, which is the cost this whole design
 * avoids. The server's copy wins — it carries the new `version`, and a write
 * built on a stale one is the 412 nobody expects.
 */
function writeAtomThrough(client: QueryClient, atom: Atom) {
  if (!atom.id) return;

  client.setQueryData(profileKeys.atom(atom.id), atom);
  client.setQueriesData<Atom[]>({ queryKey: ATOM_COLLECTIONS }, (list) =>
    list?.map((cached) => (cached.id === atom.id ? atom : cached)),
  );
}

/** Applies a change to an atom in both caches, and reports how to undo it. */
function updateAtomThrough(client: QueryClient, id: string, change: (atom: Atom) => Atom) {
  const previous = client.getQueryData<Atom>(profileKeys.atom(id));
  if (previous) writeAtomThrough(client, change(previous));
  return previous;
}

/**
 * Atom controls: importance, active, the pins, the matching lists.
 *
 * Optimistic, because these are direct manipulations — a slider that waits
 * for a round trip before moving feels broken (Bölüm 37.2). Text is not
 * edited here; that is `patchVariant` below.
 */
export function usePatchAtom() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch, version }: { id: string; patch: AtomPatch; version: Version }) =>
      patchAtom(id, patch, version),

    onMutate: async ({ id, patch }) => {
      // Stop an in-flight read from landing on top of the optimistic value.
      await client.cancelQueries({ queryKey: profileKeys.atom(id) });
      return { previous: updateAtomThrough(client, id, (atom) => ({ ...atom, ...patch })) };
    },

    onError: (_error, _variables, context) => {
      // Roll back to exactly what was there, including its version. A 412 is
      // handled by the caller, which is the only place that knows whether to
      // ask the user or retry silently.
      if (context?.previous) writeAtomThrough(client, context.previous);
    },

    onSuccess: (atom) => writeAtomThrough(client, atom),
  });
}

/**
 * Wording. The whole content is sent — there is no partial text update.
 *
 * Making a variant primary is the exception to writing through. The server
 * demotes whichever variant was primary before and only returns the one that
 * was written, so merging that response would leave two atoms claiming to be
 * primary and an order that no longer matches "primary first". Changing the
 * primary is a rare, deliberate click rather than a keystroke, so it pays for
 * a refetch; an ordinary text edit does not.
 */
export function usePatchVariant() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({
      atomId,
      variantId,
      body,
      version,
    }: {
      atomId: string;
      variantId: string;
      body: VariantWrite;
      version: Version;
    }) => patchVariant(atomId, variantId, body, version),

    onMutate: async ({ atomId, variantId, body }) => {
      await client.cancelQueries({ queryKey: profileKeys.atom(atomId) });

      return {
        previous: updateAtomThrough(client, atomId, (atom) => ({
          ...atom,
          variants: atom.variants?.map((variant) =>
            variant.id === variantId ? { ...variant, content: body.content } : variant,
          ),
        })),
      };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) writeAtomThrough(client, context.previous);
    },

    onSuccess: (variant, { atomId, body }) => {
      if (body.primary) {
        // Only the collections. Invalidating the per-atom key would run
        // `useAtom`'s diagnostic throw — there is no request behind it. The
        // refetch re-seeds those entries on its way through anyway.
        void client.invalidateQueries({ queryKey: ATOM_COLLECTIONS });
        return;
      }

      updateAtomThrough(client, atomId, (atom) => ({
        ...atom,
        variants: atom.variants?.map((cached) => (cached.id === variant.id ? variant : cached)),
      }));
    },
  });
}
