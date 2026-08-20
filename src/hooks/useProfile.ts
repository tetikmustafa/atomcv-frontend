'use client';

/**
 * Reads of the profile. Writes live in `useAtomMutations`; autosave, with its
 * debounces and its conflict dialog, is `useAutosave` and is built on these.
 *
 * The one non-obvious thing here is atom caching. There is no
 * `GET /profile/atoms/{id}` (`spec/08-api.md`), so the collection response is the only
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
  createAtom,
  createEntry,
  createSection,
  getProfile,
  listAtoms,
  listEntries,
  listSections,
  patchAtom,
  patchVariant,
  reorderAtoms,
  replaceProfile,
  type Atom,
  type AtomCreate,
  type AtomPatch,
  type EntryCreate,
  type Profile,
  type ProfileUpdate,
  type SectionCreate,
  type VariantPatch,
} from '@/lib/api/endpoints/profile';
import type { Versioned } from '@/lib/api/client';

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
 * answers 404 — an account without a profile gets an empty one (`spec/08-api.md`),
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
 * Replacing the profile head.
 *
 * **`PUT`, and a field left out is cleared** — verified: sending only
 * `headline` and `enabledLanguages` left `contact` as `{}`. So a caller must
 * hand over the whole head every time, never a diff, and `ProfileHead` builds
 * it from the cached copy for exactly that reason.
 *
 * The version is the `ETag`, because `Profile` carries no version field, and
 * it is read from the cache here rather than taken from the caller — the same
 * rule as `usePatchAtom`, and for the same reason: a version captured at some
 * render is stale by the second save.
 *
 * Not optimistic. Every other write in this file is, because it is a keystroke
 * on one field; this one replaces the whole resource, and rolling that back
 * means restoring nine fields the user may have been editing meanwhile. The
 * response is the truth and it arrives quickly.
 */
export function useReplaceProfile() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: ProfileUpdate) =>
      // Cast rather than defaulted, exactly as `versionOf` does: a head that
      // was never read has no ETag, and `toIfMatch` throwing with its own
      // explanation beats a request going out with no `If-Match` and coming
      // back 428.
      replaceProfile(
        body,
        client.getQueryData<Versioned<Profile>>(profileKeys.head())?.version as Version,
      ),

    // Carries the new ETag as well as the new body, so the next save has its
    // version without a read in between.
    onSuccess: (result) => client.setQueryData(profileKeys.head(), result),
  });
}

/**
 * Adding an atom, with its first wording — the endpoint takes both at once,
 * so there is no moment where a bullet exists with nothing in it.
 *
 * **Not optimistic, unlike every edit above.** An atom's identity is the
 * server's to assign, and the per-atom cache is keyed by that id. A temporary
 * one would have to be renamed the moment the response arrived, and anything
 * that had already mounted `AtomEditor` against it would be reading a key
 * about to disappear — into `useAtom`'s diagnostic throw. An edit is a
 * keystroke and cannot afford a round trip; adding is a deliberate, occasional
 * act that can.
 *
 * No `If-Match`: there is no version to quote for something that does not
 * exist yet. That also means **the server will not stop a double submit** —
 * `Idempotency-Key` covers the Stage 2 endpoints that start work, not profile
 * creates (`spec/08b-api-contract.md` § D.6.5), so two POSTs make two bullets. Keeping
 * the control disabled while `isPending` is the only thing standing between a
 * double-click and a duplicate, which is why it is the caller's obligation
 * rather than a nicety.
 */
export function useCreateAtom() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: AtomCreate) => createAtom(body),

    // The collection refetch is what seeds the new atom's per-atom entry, and
    // that entry is what `AtomEditor` reads. Writing the response into the
    // collection by hand instead would skip the seed and leave the new row
    // unable to save.
    onSuccess: () => client.invalidateQueries({ queryKey: ATOM_COLLECTIONS }),
  });
}

/**
 * Adding a section. Same shape as `useCreateAtom`, same reason for it: the
 * server assigns the id and the `displayOrder`, and no version exists to make
 * the write conditional on. The caller owns the double-submit guard.
 */
export function useCreateSection() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: SectionCreate) => createSection(body),
    onSuccess: () => client.invalidateQueries({ queryKey: profileKeys.sections() }),
  });
}

/**
 * Adding an entry.
 *
 * Invalidates the atom collections as well as the entries. Nothing about the
 * atoms changed — but a section renders its entries and its atoms from two
 * queries side by side, and leaving the second one untouched is how a new job
 * appears with the wrong bullets under it for as long as the stale list lives.
 */
export function useCreateEntry() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: EntryCreate) => createEntry(body),
    onSuccess: () => {
      // Argument-less, which is the prefix every per-section entry query
      // shares — not just the unfiltered one.
      void client.invalidateQueries({ queryKey: profileKeys.entries() });
      void client.invalidateQueries({ queryKey: ATOM_COLLECTIONS });
    },
  });
}

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

/**
 * The version a write to this atom must quote.
 *
 * Left `undefined` when the atom was never seeded, so `toIfMatch` throws with
 * its own explanation rather than a request going out without the header.
 */
function versionOf(client: QueryClient, id: string): Version {
  return client.getQueryData<Atom>(profileKeys.atom(id))?.version as Version;
}

/** The version of one wording, which moves independently of its atom's. */
function variantVersionOf(client: QueryClient, atomId: string, variantId: string): Version {
  const atom = client.getQueryData<Atom>(profileKeys.atom(atomId));
  return atom?.variants?.find((variant) => variant.id === variantId)?.version as Version;
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
    // The version comes from the cache, not from the caller. Every write puts
    // the server's copy back, so the cache always holds the current one —
    // whereas a version passed in was read at some render and may be two
    // saves old. It also makes retrying after a 412 correct for free: refetch,
    // then send again, and the fresh version is picked up without the caller
    // threading it through.
    //
    // Read here, after `onMutate` has run. That is safe because the optimistic
    // write preserves `version` — a test pins that, because an optimistic
    // update that touched it would make every following save conflict.
    mutationFn: ({ id, patch }: { id: string; patch: AtomPatch }) =>
      patchAtom(id, patch, versionOf(client, id)),

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
    }: {
      atomId: string;
      variantId: string;
      body: VariantPatch;
    }) => patchVariant(atomId, variantId, body, variantVersionOf(client, atomId, variantId)),

    onMutate: async ({ atomId, variantId, body }) => {
      await client.cancelQueries({ queryKey: profileKeys.atom(atomId) });

      // Only a write that carries content may touch it. `content` is optional
      // on this endpoint and absent means "change nothing" — but writing it
      // through unconditionally turned that absence into a clear, and a
      // promote sends `{ primary: true }` and no content. The wording the user
      // was reading blanked for the length of the round trip, textarea and
      // rich-text preview both, then came back when the response landed.
      //
      // `primary` deliberately stays out of the optimistic copy: promoting one
      // demotes another, and only the success path knows to re-sort. So a
      // body without content changes nothing here, and leaves nothing to roll
      // back — the `undefined` says that to `onError` rather than to the type.
      if (body.content === undefined) return { previous: undefined };

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
        // Promotion changes wordings the response does not mention: the server
        // demotes whichever was primary and re-sorts primary-first. Applying
        // that here is what makes the change visible at once — invalidating
        // alone would not, because a query with no observer never refetches,
        // and `AtomEditor` can be rendered without the list that has one.
        //
        // The invalidation still follows, so the server has the last word if
        // it decides anything differently. Never the per-atom key: there is no
        // request behind it, and refetching it runs `useAtom`'s diagnostic
        // throw. The collection's refetch re-seeds those entries anyway.
        updateAtomThrough(client, atomId, (atom) => ({
          ...atom,
          variants: atom.variants
            ?.map((cached) => ({
              ...(cached.id === variant.id ? variant : cached),
              primary: cached.id === variant.id,
            }))
            .sort((a, b) => Number(b.primary) - Number(a.primary)),
        }));

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

/**
 * Reordering atoms within a section, or within an entry inside it.
 *
 * The complete list goes to the server every time — a partial one is a 400,
 * and `displayOrder` cannot be patched directly (`spec/08-api.md`). No `If-Match`
 * either: order is a property of the collection, and collections have no
 * version.
 *
 * Optimistic, because a list that snaps back to its old order for the length
 * of a round trip reads as a failed drop. Reconciled by invalidating on
 * success rather than by trusting the optimistic copy: the server renumbers
 * `displayOrder`, and while nothing renders that field today, leaving the
 * cache holding numbers that disagree with the order is the kind of quiet
 * inconsistency that only surfaces once something does read it. A drop is a
 * deliberate, occasional gesture, so it can afford the refetch that a
 * keystroke cannot.
 *
 * The response does carry the renumbered atoms, so the refetch looks
 * skippable — it is not. It covers **only the group that was reordered**: a
 * five-atom entry answers with five while the section's cached list holds
 * ten, and those same atoms are cached under both keys. Writing it through
 * would reconcile one and leave the other stale. Measured against the running
 * backend, not assumed.
 */
export function useReorderAtoms() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({
      sectionId,
      ids,
      entryId,
    }: {
      sectionId: string;
      ids: string[];
      entryId?: string;
    }) => reorderAtoms(sectionId, ids, entryId),

    onMutate: async ({ ids }) => {
      await client.cancelQueries({ queryKey: ATOM_COLLECTIONS });

      const previous = client.getQueriesData<Atom[]>({ queryKey: ATOM_COLLECTIONS });

      client.setQueriesData<Atom[]>({ queryKey: ATOM_COLLECTIONS }, (list) => {
        if (!list) return list;
        const byId = new Map(list.map((atom) => [atom.id, atom]));
        const moved = ids.map((id) => byId.get(id)).filter((atom): atom is Atom => Boolean(atom));
        // Anything the reorder did not name stays where it was — the call is
        // scoped to one group, and other groups share the same cached list.
        const untouched = list.filter((atom) => !ids.includes(atom.id!));
        return [...moved, ...untouched];
      });

      return { previous };
    },

    onError: (_error, _variables, context) => {
      for (const [key, list] of context?.previous ?? []) {
        client.setQueryData(key, list);
      }
    },

    onSettled: () => {
      void client.invalidateQueries({ queryKey: ATOM_COLLECTIONS });
    },
  });
}
