/**
 * The Stage 1 profile API, one function per operation.
 *
 * Everything here is a thin, typed call. No caching, no merging, no
 * invalidation — those belong to the hooks in `src/hooks`, and keeping them
 * out means each function can be read against the endpoint it names.
 *
 * **Every shape is bound to the operation it belongs to**, through `Returns`
 * and `Accepts` in `../operations`, rather than picked out of
 * `components['schemas']` by hand. Naming the item type was all the generator
 * allowed while ten operations declared no success response (handoff B-029);
 * now that they do, the binding is what makes a change to the response
 * *wrapper* a typecheck failure instead of a runtime surprise. It caught one
 * the day it was written — see `reorder*`.
 */

import { api, type Versioned } from '../client';
import type { Version } from '../etag';
import type { Accepts, Returns } from '../operations';
import type { components } from '@/types/api';

type Schemas = components['schemas'];

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
export type ProfileExport = Returns<'exportProfile'>;

export type ProfileUpdate = Accepts<'replaceProfile'>;
export type PreferencesUpdate = Accepts<'replacePreferences'>;

/**
 * The preferences as they are read back, off the head.
 *
 * There is no `GET /profile/preferences`: they arrive inside `GET /profile`
 * and the write answers with the whole head again. Derived from the read type
 * rather than named out of `components['schemas']`, so a field the server
 * moves shows up here as a typecheck failure.
 */
export type Preferences = NonNullable<Profile['preferences']>;

/**
 * What the CV is set to look like (§ 33.2, `B-091`).
 *
 * **Every field is optional, and leaving one out means "the template's own
 * setting"** — not zero and not a default of ours. That is what lets a
 * template change its own defaults later and take a profile that never
 * overrode them along with it.
 *
 * Derived through `PreferencesUpdate` rather than from the read shape: the
 * write schema is what a write must satisfy, and the two drifted apart once
 * already — springdoc published the record's `isEmpty()` as an `empty`
 * property on the read alone, so a value read straight back sent a field the
 * write did not declare. Fixed at the source (`B-099`, § 35.8.2); deriving
 * from the write is what would have made it a typecheck failure instead of a
 * sifting step in the form.
 */
export type AppearanceUpdate = NonNullable<
  NonNullable<PreferencesUpdate['defaults']>['appearance']
>;

/**
 * § 33.2's ranges, and the reason they are narrow: a bad-looking result
 * should be physically impossible rather than discouraged.
 *
 * Hand-written because `minimum`/`maximum` do not survive into a TypeScript
 * type. They are the server's, written twice there as well (the record and
 * the endpoint), and a value outside them is a `400` — so these keep a slider
 * from reaching a wall rather than standing in for the check.
 */
export const APPEARANCE_RANGES = {
  fontSizePt: { min: 9, max: 12, step: 0.5 },
  marginInches: { min: 0.4, max: 1, step: 0.05 },
  lineSpacing: { min: 0.9, max: 1.3, step: 0.05 },
} as const;

/**
 * § 33.2's warning, not a block: 9pt is legal and the reader is told what it
 * costs rather than stopped.
 */
export const ATS_READABLE_FONT_SIZE_PT = 10;

/**
 * The three families the pattern allows.
 *
 * The schema publishes `fontFamily` as a `string` with a regex, so there is no
 * generated union to derive from. A value outside this list is the server's to
 * refuse; what this list decides is only which three buttons get drawn.
 */
export const FONT_FAMILIES = ['MODERN', 'SERIF', 'SANS'] as const;

/** Six hex digits, no `#` — the shape the server stores and validates. */
export const ACCENT_COLOR_PATTERN = /^[0-9A-Fa-f]{6}$/;
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
  return api.delete<Returns<'deleteProfile'>>('/profile', { version });
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
  return api.get<Returns<'exportProfile'>>(`/profile/export${query({ format: 'json' })}`);
}

export function exportProfileAsMarkdown() {
  return api.getText(`/profile/export${query({ format: 'markdown' })}`);
}

/* -------------------------------- import ------------------------------- */

/**
 * How a profile usually starts: a CV, read by the extraction pipeline
 * (§ 31.2, `B-051`).
 *
 * **`202` and a job**, the same shape a generation answers with, so the
 * stream and the fallback poll are the ones already in hand. Everything a
 * file can be refused for arrives *before* that, synchronously: § 31.10's
 * first three steps are things the reader acts on immediately, and finding
 * out eight seconds later that the PDF was encrypted is a worse version of
 * the same answer.
 *
 * **The part name is `file` and there is exactly one.** `FormData` sets its
 * own `Content-Type` with the boundary in it — see the client.
 *
 * **`Idempotency-Key` matters more here than anywhere else.** An upload is
 * the request a bad connection retries most readily, and profile extraction
 * is the smallest allowance in the product (§ 44.1): three a day anonymously.
 * The same key returns the job already made rather than spending a second
 * unit.
 *
 * **`mode` is only ever `replace`, and only as the answer to a `409`**
 * (`B-060`). The server reads anything else as absent, so a typo cannot stand
 * in for consent — and nothing here sends it unless the reader pressed the
 * resolution the server offered.
 *
 * **`challengeToken` is a form field, not a header** (§ 35.7.4, `B-083`), and
 * it is required of a caller without an account: this and `POST /generations`
 * are the two anonymous requests that spend model money, and the quota
 * counters of § 44.1 say *how much* rather than *who*. Omitted rather than
 * sent empty where there is none — an empty value is a **failure**, while an
 * absent one is what a deployment with no Turnstile secret expects.
 */
export function importCv(
  file: File,
  {
    idempotencyKey,
    replace = false,
    challengeToken,
  }: { idempotencyKey: string; replace?: boolean; challengeToken?: string },
) {
  const form = new FormData();
  form.append('file', file);
  if (challengeToken) form.append('challengeToken', challengeToken);

  return api.post<Returns<'importCv', '*/*'>>(
    `/profile/import${query({ mode: replace ? 'replace' : undefined })}`,
    form,
    { idempotencyKey },
  );
}
