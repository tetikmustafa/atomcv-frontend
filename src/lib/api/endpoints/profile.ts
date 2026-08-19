/**
 * The Stage 1 profile API, one function per operation.
 *
 * Everything here is a thin, typed call. No caching, no merging, no
 * invalidation — those belong to the hooks in `src/hooks`, and keeping them
 * out means each function can be read against the endpoint it names.
 *
 * **Types come from `components['schemas']`, not from `operations`.** The
 * published schema declares no success response on ten operations — every
 * `PATCH` and every collection `GET` among them — so `operations` has nothing
 * to offer for exactly the calls the editor leans on. The item schemas are
 * complete and generated, so the request and response shapes below are still
 * derived rather than invented; only the response *wrapper* is stated here,
 * and it is verified against the running server. Raised in
 * `DOC-SYNC-REQUEST.md`; delete this paragraph when the schema declares them.
 */

import { api, type Versioned } from '../client';
import type { Version } from '../etag';
import type { components } from '@/types/api';

type Schemas = components['schemas'];

export type Profile = Schemas['Profile'];
export type ProfileUpdate = Schemas['ProfileUpdate'];
export type PreferencesUpdate = Schemas['PreferencesUpdate'];
export type Section = Schemas['Section'];
export type SectionCreate = Schemas['SectionCreate'];
export type SectionPatch = Schemas['SectionPatch'];
export type Entry = Schemas['Entry'];
export type EntryCreate = Schemas['EntryCreate'];
export type Atom = Schemas['Atom'];
export type AtomCreate = Schemas['AtomCreate'];
export type AtomPatch = Schemas['AtomPatch'];
export type Variant = Schemas['Variant'];
/** Creating a wording: the content is the point, so it is required. */
export type VariantWrite = Schemas['VariantWrite'];

/**
 * Changing one. Nothing is required — a promote is `{ primary: true }` and
 * carries no content, which is the whole difference from `VariantWrite`.
 *
 * `tone` is three-state: omit it to keep what is there, send `null` to return
 * to the neutral register.
 */
export type VariantPatch = Schemas['VariantPatch'];

/**
 * `organization` and `endDate` are `["string", "null"]` in the schema, so the
 * generated type already expresses the clear that D.9 · 16 is about — sending
 * `null` to remove an end date and mean "this job is current". This used to be
 * widened by hand here (handoff B-029).
 */
export type EntryPatch = Schemas['EntryPatch'];
export type ProfileExport = Schemas['ProfileExport'];

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
 * Never answers 404 (D.9 · 13). A user who has never had a profile gets an
 * empty one created on read, so there is no "not created yet" state.
 */
export function getProfile(): Promise<Versioned<Profile>> {
  return api.getVersioned<Profile>('/profile');
}

/**
 * Replaces the head. A field left out is **cleared** (D.9 · 15), so the form
 * must send every field it owns, not only the ones that changed.
 */
export function replaceProfile(body: ProfileUpdate, version: Version) {
  return api.putVersioned<Profile>('/profile', body, { version });
}

/** `PUT`, not `PATCH` — Bölüm 35.2's list is out of date, D.9 · 15 is right. */
export function replacePreferences(body: PreferencesUpdate, version: Version) {
  return api.putVersioned<Profile>('/profile/preferences', body, { version });
}

export function deleteProfile(version: Version) {
  return api.delete<void>('/profile', { version });
}

/* ------------------------------- sections ------------------------------ */

export function listSections() {
  return api.get<Section[]>('/profile/sections');
}

export function createSection(body: SectionCreate) {
  return api.post<Section>('/profile/sections', body);
}

export function patchSection(id: string, body: SectionPatch, version: Version) {
  return api.patch<Section>(`/profile/sections/${id}`, body, { version });
}

export function deleteSection(id: string, version: Version) {
  return api.delete<void>(`/profile/sections/${id}`, { version });
}

/**
 * Takes the **complete** list, not the moved items — a partial one is a 400,
 * and `displayOrder` cannot be patched directly (D.9 · 19). No `If-Match`:
 * ordering is a property of the collection, which has no version.
 */
export function reorderSections(ids: string[]) {
  return api.post<void>('/profile/sections/reorder', { ids });
}

/* -------------------------------- entries ------------------------------ */

export function listEntries(sectionId?: string) {
  return api.get<Entry[]>(`/profile/entries${query({ sectionId })}`);
}

export function createEntry(body: EntryCreate) {
  return api.post<Entry>('/profile/entries', body);
}

export function patchEntry(id: string, body: EntryPatch, version: Version) {
  return api.patch<Entry>(`/profile/entries/${id}`, body, { version });
}

export function deleteEntry(id: string, version: Version) {
  return api.delete<void>(`/profile/entries/${id}`, { version });
}

export function reorderEntries(sectionId: string, ids: string[]) {
  return api.post<void>('/profile/entries/reorder', { sectionId, ids });
}

/* --------------------------------- atoms ------------------------------- */

/**
 * Unpaginated by decision, and there is no `GET /profile/atoms/{id}` — this
 * response is the only place a per-atom version comes from, which is why the
 * hooks seed the per-atom cache from it.
 */
export function listAtoms(filter: { sectionId?: string; entryId?: string } = {}) {
  return api.get<Atom[]>(`/profile/atoms${query(filter)}`);
}

/** Atoms are created **with** their first wording; the content is required. */
export function createAtom(body: AtomCreate) {
  return api.post<Atom>('/profile/atoms', body);
}

/**
 * Controls only — importance, active, pins, the matching lists. Text is
 * edited through the variant endpoints (D.9 · 17), so nothing here touches
 * wording.
 */
export function patchAtom(id: string, body: AtomPatch, version: Version) {
  return api.patch<Atom>(`/profile/atoms/${id}`, body, { version });
}

export function deleteAtom(id: string, version: Version) {
  return api.delete<void>(`/profile/atoms/${id}`, { version });
}

/** `entryId` omitted orders the atoms hanging straight off the section. */
export function reorderAtoms(sectionId: string, ids: string[], entryId?: string) {
  return api.post<void>('/profile/atoms/reorder', {
    sectionId,
    ids,
    ...(entryId ? { entryId } : {}),
  });
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
  return api.post<Variant>(`/profile/atoms/${atomId}/variants`, body);
}

export function patchVariant(
  atomId: string,
  variantId: string,
  body: VariantPatch,
  version: Version,
) {
  return api.patch<Variant>(`/profile/atoms/${atomId}/variants/${variantId}`, body, { version });
}

export function deleteVariant(atomId: string, variantId: string, version: Version) {
  return api.delete<void>(`/profile/atoms/${atomId}/variants/${variantId}`, { version });
}

/* -------------------------------- export ------------------------------- */

/**
 * Two endpoints wearing one path. `?format=json` answers with
 * `ProfileExport`; `?format=markdown` answers `text/markdown`, which is a
 * string and throws if read as JSON. The schema declares only the JSON half,
 * so the split is stated here — see `DOC-SYNC-REQUEST.md`.
 */
export function exportProfileAsJson() {
  return api.get<ProfileExport>(`/profile/export${query({ format: 'json' })}`);
}

export function exportProfileAsMarkdown() {
  return api.getText(`/profile/export${query({ format: 'markdown' })}`);
}
