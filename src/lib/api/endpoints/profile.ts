/**
 * The Stage 1 profile API, one function per operation.
 *
 * Everything here is a thin, typed call. No caching, no merging, no
 * invalidation — those belong to the hooks in `src/hooks`, and keeping them
 * out means each function can be read against the endpoint it names.
 *
 * **Every shape is bound to the operation it belongs to**, through `Returns`
 * and `Accepts` below, rather than picked out of `components['schemas']` by
 * hand. Naming the item type was all the generator allowed while ten
 * operations declared no success response (handoff B-029); now that they do,
 * the binding is what makes a change to the response *wrapper* a typecheck
 * failure instead of a runtime surprise. It caught one the day it was
 * written — see `reorder*`.
 */

import { api, type Versioned } from '../client';
import type { Version } from '../etag';
import type { components, operations } from '@/types/api';

type Schemas = components['schemas'];

type Responses<Op extends keyof operations> = operations[Op]['responses'];

/** The one success response an operation declares. */
type Success<Op extends keyof operations> = Responses<Op>[Extract<
  keyof Responses<Op>,
  200 | 201 | 204
>];

/**
 * What a call resolves to: the success body in the media type asked for, or
 * `void` where the response declares no content at all. A 204 lands on the
 * second branch, which is why `delete*` needs no special case.
 */
type Returns<Op extends keyof operations, Media extends string = 'application/json'> =
  Success<Op> extends { content: infer Body }
    ? Media extends keyof Body
      ? Body[Media]
      : never
    : void;

/** What a call sends. */
type Accepts<Op extends keyof operations> = operations[Op] extends {
  requestBody: { content: { 'application/json': infer Body } };
}
  ? Body
  : never;

/* -------------------------------------------------------------------------
 * The item types
 *
 * These name what the API is *about*, so they stay on the schema: `domain.ts`
 * narrows them, components hold them, and routing them through an operation
 * would say which endpoint happened to mention one first. The operations bind
 * the calls below; the schema binds the nouns.
 * ---------------------------------------------------------------------- */

/**
 * The head as it actually arrives.
 *
 * `sourceLanguage` is narrowed to required, derived rather than restated. The
 * column is `NOT NULL` server-side and `PUT /profile` refuses a body without
 * it (`B-035`), so a head reaching the client without one is not a state to
 * branch on — it is a contract violation, and springdoc marks the response
 * field optional only because it marks almost everything optional.
 *
 * Narrowing it here rather than at the call site is what keeps the write path
 * honest: `ProfileUpdate` requires the field, and the alternative to this line
 * is a `?? 'en'` somewhere — which is precisely the silent
 * Turkish-profile-becomes-English the backend refused to ship.
 */
export type Profile = Omit<Schemas['Profile'], 'sourceLanguage'> & { sourceLanguage: string };
export type Section = Schemas['Section'];
export type Entry = Schemas['Entry'];
export type Atom = Schemas['Atom'];
export type Variant = Schemas['Variant'];
export type ProfileExport = Returns<'export'>;

export type ProfileUpdate = Accepts<'replace'>;
export type PreferencesUpdate = Accepts<'replacePreferences'>;
export type SectionCreate = Accepts<'createSection'>;
export type SectionPatch = Accepts<'patchSection'>;
export type EntryCreate = Accepts<'createEntry'>;
export type AtomCreate = Accepts<'createAtom'>;
export type AtomPatch = Accepts<'patchAtom'>;
/** Creating a wording: the content is the point, so it is required. */
export type VariantWrite = Accepts<'addVariant'>;

/**
 * Changing one. Nothing is required — a promote is `{ primary: true }` and
 * carries no content, which is the whole difference from `VariantWrite`.
 *
 * `tone` is three-state: omit it to keep what is there, send `null` to return
 * to the neutral register.
 */
export type VariantPatch = Accepts<'patchVariant'>;

/**
 * `organization` and `endDate` are `["string", "null"]` in the schema, so the
 * generated type already expresses the clear that `spec/08-api.md` describes —
 * sending `null` to remove an end date and mean "this job is current". This
 * used to be widened by hand here (handoff B-029).
 */
export type EntryPatch = Accepts<'patchEntry'>;

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, value);
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : '';
}

/* -------------------------------------------------------------------------
 * The profile head
 *
 * `Profile` and `Preferences` carry no `version` field, so their version
 * arrives only in the `ETag` header — hence the versioned calls. Everything
 * below the head carries `version` in the body and uses plain `api.*`.
 * ---------------------------------------------------------------------- */

/**
 * Never answers 404 (`spec/08-api.md`). A user who has never had a profile gets an
 * empty one created on read, so there is no "not created yet" state.
 */
export function getProfile(): Promise<Versioned<Profile>> {
  return api.getVersioned<Profile>('/profile');
}

/**
 * Replaces the head. A field left out is **cleared** (`spec/08-api.md`), so the form
 * must send every field it owns, not only the ones that changed.
 */
export function replaceProfile(body: ProfileUpdate, version: Version) {
  // The same narrowed shape the read returns: this response *is* the head, and
  // it is what `useReplaceProfile` writes straight into the cache.
  return api.putVersioned<Profile>('/profile', body, { version });
}

/** `PUT`, not `PATCH` — § 35.2's endpoint list is out of date; `spec/08-api.md` is right. */
export function replacePreferences(body: PreferencesUpdate, version: Version) {
  return api.putVersioned<Returns<'replacePreferences'>>('/profile/preferences', body, { version });
}

export function deleteProfile(version: Version) {
  return api.delete<Returns<'delete'>>('/profile', { version });
}

/* ------------------------------- sections ------------------------------ */

export function listSections() {
  return api.get<Returns<'listSections'>>('/profile/sections');
}

export function createSection(body: SectionCreate) {
  return api.post<Returns<'createSection'>>('/profile/sections', body);
}

export function patchSection(id: string, body: SectionPatch, version: Version) {
  return api.patch<Returns<'patchSection'>>(`/profile/sections/${id}`, body, { version });
}

export function deleteSection(id: string, version: Version) {
  return api.delete<Returns<'deleteSection'>>(`/profile/sections/${id}`, { version });
}

/**
 * Takes the **complete** list, not the moved items — a partial one is a 400,
 * and `displayOrder` cannot be patched directly (`spec/08-api.md`). No `If-Match`:
 * ordering is a property of the collection, which has no version.
 *
 * **Answers with the reordered collection**, renumbered. This was typed
 * `void` until the operations were bound here, on the strength of a mock that
 * answered `200` with nothing — the running server has always sent the list.
 * A caller may write it straight through instead of refetching.
 */
export function reorderSections(ids: string[]) {
  return api.post<Returns<'reorderSections'>>('/profile/sections/reorder', {
    ids,
  } satisfies Accepts<'reorderSections'>);
}

/* -------------------------------- entries ------------------------------ */

export function listEntries(sectionId?: string) {
  return api.get<Returns<'listEntries'>>(`/profile/entries${query({ sectionId })}`);
}

export function createEntry(body: EntryCreate) {
  return api.post<Returns<'createEntry'>>('/profile/entries', body);
}

export function patchEntry(id: string, body: EntryPatch, version: Version) {
  return api.patch<Returns<'patchEntry'>>(`/profile/entries/${id}`, body, { version });
}

export function deleteEntry(id: string, version: Version) {
  return api.delete<Returns<'deleteEntry'>>(`/profile/entries/${id}`, { version });
}

/** As `reorderSections`, and it answers the same way. */
export function reorderEntries(sectionId: string, ids: string[]) {
  return api.post<Returns<'reorderEntries'>>('/profile/entries/reorder', {
    sectionId,
    ids,
  } satisfies Accepts<'reorderEntries'>);
}

/* --------------------------------- atoms ------------------------------- */

/**
 * Unpaginated by decision, and there is no `GET /profile/atoms/{id}` — this
 * response is the only place a per-atom version comes from, which is why the
 * hooks seed the per-atom cache from it.
 */
export function listAtoms(filter: { sectionId?: string; entryId?: string } = {}) {
  return api.get<Returns<'listAtoms'>>(`/profile/atoms${query(filter)}`);
}

/** Atoms are created **with** their first wording; the content is required. */
export function createAtom(body: AtomCreate) {
  return api.post<Returns<'createAtom'>>('/profile/atoms', body);
}

/**
 * Controls only — importance, active, pins, the matching lists. Text is
 * edited through the variant endpoints (`spec/08-api.md`), so nothing here touches
 * wording.
 */
export function patchAtom(id: string, body: AtomPatch, version: Version) {
  return api.patch<Returns<'patchAtom'>>(`/profile/atoms/${id}`, body, { version });
}

export function deleteAtom(id: string, version: Version) {
  return api.delete<Returns<'deleteAtom'>>(`/profile/atoms/${id}`, { version });
}

/** `entryId` omitted orders the atoms hanging straight off the section. */
export function reorderAtoms(sectionId: string, ids: string[], entryId?: string) {
  return api.post<Returns<'reorderAtoms'>>('/profile/atoms/reorder', {
    sectionId,
    ids,
    ...(entryId ? { entryId } : {}),
  } satisfies Accepts<'reorderAtoms'>);
}

/* ------------------------------- variants ------------------------------ */

/**
 * Wording. A text edit sends the whole content — there is no partial text
 * update — but a patch that is not about text sends only what changes, and
 * must: resending the wording used to clear the user's `tone` (B-028).
 *
 * The atom's own version is not involved either way: variants version
 * independently of the atom that owns them.
 */
export function addVariant(atomId: string, body: VariantWrite) {
  return api.post<Returns<'addVariant'>>(`/profile/atoms/${atomId}/variants`, body);
}

export function patchVariant(
  atomId: string,
  variantId: string,
  body: VariantPatch,
  version: Version,
) {
  return api.patch<Returns<'patchVariant'>>(
    `/profile/atoms/${atomId}/variants/${variantId}`,
    body,
    { version },
  );
}

export function deleteVariant(atomId: string, variantId: string, version: Version) {
  return api.delete<Returns<'deleteVariant'>>(`/profile/atoms/${atomId}/variants/${variantId}`, {
    version,
  });
}

/* -------------------------------- export ------------------------------- */

/**
 * Two endpoints wearing one path, and one operation: the `200` declares both
 * `application/json` and `text/markdown`, so the media type is what picks the
 * body (handoff B-031). Splitting into two functions is what keeps the
 * response types honest, since one is parsed and the other is not.
 */
export function exportProfileAsJson() {
  return api.get<Returns<'export'>>(`/profile/export${query({ format: 'json' })}`);
}

export function exportProfileAsMarkdown() {
  return api.getText(`/profile/export${query({ format: 'markdown' })}`);
}
