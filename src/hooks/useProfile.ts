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
  deleteAtom,
  deleteEntry,
  deleteSection,
  getProfile,
  listAtoms,
  listEntries,
  listSections,
  patchAtom,
  patchVariant,
  reorderAtoms,
  reorderEntries,
  reorderSections,
  replaceProfile,
  type Atom,
  type AtomCreate,
  type AtomPatch,
  type Entry,
  type EntryCreate,
  type Profile,
  type Section,
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
            ?.map((cached) => {
              if (cached.id === variant.id) return { ...variant, primary: true };

              // B-034. The demoted row is a write like any other and the
              // server versions it, so the cached copy has to move with it.
              // Leaving it behind holds an etag that is one save stale, and
              // the next edit to that wording — still on screen, still in the
              // other tab — comes back 412 with nothing to explain it. The
              // window closes when the invalidation lands, which is exactly
              // the kind of bug that survives review by being intermittent.
              //
              // Only this row. The atom's other wordings take no part in the
              // promotion and are not versioned; bumping them would invalidate
              // etags that are still good and break the next legitimate edit.
              const demoted = cached.primary === true;

              return {
                ...cached,
                primary: false,
                // `version` is optional on the wire. Absent means we never
                // had an etag for this row, and inventing `NaN` would send
                // `If-Match: "NaN"` instead of letting `toIfMatch` say so.
                ...(demoted && cached.version !== undefined ? { version: cached.version + 1 } : {}),
              };
            })
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

/**
 * Reordering the sections themselves.
 *
 * ⚠️ **A reorder is a write, and the server versions every row it moves** —
 * measured: four sections at `version` 0, swap the first two, and they come
 * back `[1, 1, 0, 0]`. The two that did not move are untouched. Proven to
 * matter, not reasoned about: patching an entry with its pre-reorder version
 * answers **412**.
 *
 * So the response is written straight into the cache rather than only
 * invalidated. It is the complete collection, renumbered and re-versioned, so
 * the write-through is total and there is nothing left to refetch — and,
 * unlike an invalidation, it closes the window in which a delete built from
 * the cached version would quote a number the server has already passed.
 * `useDeleteSection` reads exactly that number.
 *
 * Optimistic for the same reason as the atoms: a list that snaps back for the
 * length of a round trip reads as a failed drop.
 */
export function useReorderSections() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => reorderSections(ids),

    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: profileKeys.sections() });
      const previous = client.getQueryData<Section[]>(profileKeys.sections());

      client.setQueryData<Section[]>(profileKeys.sections(), (list) => {
        if (!list) return list;
        const byId = new Map(list.map((section) => [section.id, section]));
        return ids
          .map((id) => byId.get(id))
          .filter((section): section is Section => Boolean(section));
      });

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(profileKeys.sections(), context.previous);
    },

    // The whole collection, with the versions the next write has to quote.
    onSuccess: (sections) => client.setQueryData(profileKeys.sections(), sections),
  });
}

/**
 * Reordering the entries inside one section.
 *
 * Versions move here too, and this one is where it was demonstrated: reorder
 * two entries, then `PATCH` one of them with the version read before — 412.
 *
 * **The response covers only that section's group** — two rows where the
 * profile has six — which is the same scope the atom reorder answers with,
 * and the same trap: writing the group over an unfiltered cached list would
 * drop the other four. So it is merged by id into every cached entries list,
 * and the invalidation still follows for anything the merge could not reach.
 *
 * Their atoms are not versioned by this. Measured, because "reordering the
 * parent touches the children" would have been a reasonable guess and would
 * have meant invalidating the atom collections too.
 */
export function useReorderEntries() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ sectionId, ids }: { sectionId: string; ids: string[] }) =>
      reorderEntries(sectionId, ids),

    onMutate: async ({ ids }) => {
      await client.cancelQueries({ queryKey: profileKeys.entries() });
      const previous = client.getQueriesData<Entry[]>({ queryKey: profileKeys.entries() });

      client.setQueriesData<Entry[]>({ queryKey: profileKeys.entries() }, (list) => {
        if (!list) return list;
        const byId = new Map(list.map((entry) => [entry.id, entry]));
        const moved = ids
          .map((id) => byId.get(id))
          .filter((entry): entry is Entry => Boolean(entry));
        // Everything the call did not name keeps its place: an unfiltered list
        // holds the other sections' entries as well.
        const untouched = list.filter((entry) => !ids.includes(entry.id!));
        return [...moved, ...untouched];
      });

      return { previous };
    },

    onError: (_error, _variables, context) => {
      for (const [key, list] of context?.previous ?? []) client.setQueryData(key, list);
    },

    onSuccess: (group) => {
      // Fresh versions now, not after a refetch — that gap is a 412 for
      // anything that writes to a moved entry in the meantime.
      const byId = new Map(group.map((entry) => [entry.id, entry]));

      client.setQueriesData<Entry[]>({ queryKey: profileKeys.entries() }, (list) =>
        list?.map((entry) => byId.get(entry.id) ?? entry),
      );
    },

    onSettled: () => {
      void client.invalidateQueries({ queryKey: profileKeys.entries() });
    },
  });
}

/* -------------------------------- deletes ------------------------------- */

/**
 * The version a delete must quote, for a resource that is only ever cached as
 * part of a list.
 *
 * Sections and entries have no per-item cache — nothing needed one until now,
 * because every other write to them goes through a form that has the item in
 * hand. Left `undefined` when the list was never read, on the same principle
 * as `versionOf`: `toIfMatch` explains itself, a missing header comes back
 * `428` and explains nothing.
 */
function versionInList(client: QueryClient, key: readonly unknown[], id: string): Version {
  const list = client.getQueriesData<{ id?: string; version?: number }[]>({ queryKey: key });

  for (const [, items] of list) {
    const found = items?.find((item) => item.id === id);
    if (found?.version !== undefined) return found.version as Version;
  }

  return undefined as unknown as Version;
}

/**
 * What every delete invalidates.
 *
 * **The head is in here although nothing was measured moving it.** Adding a
 * section with an atom left `completeness` at 80, so the obvious conclusion is
 * that this refetch is dead weight. It is not a safe conclusion: the only
 * thing measured was *adding a little*, and what a cascade removes is a whole
 * section's worth of content — which could not be tested without destroying
 * the seed. `completeness` is computed server-side and drives a bar on this
 * very screen, so one small `GET /profile` is the cheap side of the bet.
 *
 * **Never `profileKeys.all`,** although `queryKeys.ts` calls that the right
 * move after a destructive change. It is a prefix of the per-atom keys too,
 * and those have no endpoint behind them: invalidating one with a mounted
 * editor refetches it straight into `useAtom`'s diagnostic throw. The
 * collections below re-seed every atom that survived, which is what that
 * advice was actually after.
 *
 * The per-atom entries of atoms that did *not* survive are left alone rather
 * than removed. `removeQueries` on a key with an active observer triggers a
 * refetch — the same throw — and the editor for a deleted atom is still
 * mounted until the collection refetch drops it from the list. With no
 * observer left, they are garbage collected on their own.
 */
function invalidateAfterDelete(client: QueryClient) {
  void client.invalidateQueries({ queryKey: profileKeys.sections() });
  void client.invalidateQueries({ queryKey: profileKeys.entries() });
  void client.invalidateQueries({ queryKey: ATOM_COLLECTIONS });
  void client.invalidateQueries({ queryKey: profileKeys.head() });
}

/**
 * Deleting a section, and everything under it.
 *
 * **The cascade is the server's, and it is total** — measured: the entries go,
 * the atoms under those entries go, and the atoms hanging straight off the
 * section go with them. Nothing is re-parented. That is why the confirmation
 * has to carry counts: the control says "delete this section" and the server
 * hears "delete these nineteen things".
 *
 * Not optimistic. Every optimistic write in this file can be rolled back from
 * a captured copy; this one cannot — the rollback would have to restore a
 * tree of entries, atoms and wordings with the ids the server chose, and no
 * endpoint recreates them. A deletion that flickered back into existence
 * after a 412 would also be the single most alarming thing the editor could
 * do. So it waits, and the confirmation is what covers the delay.
 */
export function useDeleteSection() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      deleteSection(id, versionInList(client, profileKeys.sections(), id)),
    onSuccess: () => invalidateAfterDelete(client),
  });
}

/** Deleting an entry. Its atoms go with it — measured, and not re-parented. */
export function useDeleteEntry() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteEntry(id, versionInList(client, profileKeys.entries(), id)),
    onSuccess: () => invalidateAfterDelete(client),
  });
}

/**
 * Deleting one atom. The version comes from the per-atom cache, as every atom
 * write does.
 */
export function useDeleteAtom() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAtom(id, versionOf(client, id)),
    onSuccess: () => invalidateAfterDelete(client),
  });
}
