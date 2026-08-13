/**
 * Builds a JSON Merge Patch body, dropping keys whose value is `undefined`.
 *
 * Why this exists: in merge-patch, an absent key means "leave it alone" and
 * an explicit `null` means "clear it". `JSON.stringify` drops `undefined`
 * values, so `{ importance: undefined }` silently becomes `{}` — a request
 * that succeeds, changes nothing, and still flips the save indicator to
 * "saved" (Bölüm 37.3). That is the editor lying to the user.
 *
 * TypeScript would catch this with `exactOptionalPropertyTypes`, but that
 * flag costs friction across every optional React prop for one real hazard.
 * The hazard lives here, so the guard lives here too.
 *
 * Returns `null` when nothing is left to send, forcing callers to skip the
 * request rather than fire an empty one.
 */
export function buildPatch<T extends Record<string, unknown>>(fields: T): Partial<T> | null {
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) patch[key] = value;
  }

  return Object.keys(patch).length > 0 ? (patch as Partial<T>) : null;
}
