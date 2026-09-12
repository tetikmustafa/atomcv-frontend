/**
 * Where somebody applied, with which resume, and what came of it (§ 55,
 * `B-093`).
 *
 * **Four endpoints and no pagination.** This is a table somebody scans, not a
 * feed they scroll, so `GET` answers with the whole list — newest first — and
 * there is no cursor to echo. Filtering by status is not published either; it
 * arrives with pagination when there is enough to page.
 *
 * **Every one of them needs an account.** A record of applying outlives the
 * two-hour anonymous session by design, so there is nothing here for a caller
 * without one, and the screen says so rather than asking and being refused.
 *
 * The table has existed since V1; nothing migrated to land this.
 */

import { api } from '../client';
import type { Accepts, Returns } from '../operations';
import type { Version } from '../etag';

/**
 * All four operations are bound **by path**, not by operation id.
 *
 * springdoc numbers an id when the controller method name is not unique
 * across the application, and the number is positional: `list_1`, `create`,
 * `update_1`, `delete_1` are what this controller happens to have been given,
 * and adding a fifth controller could shift any of them onto somebody else's
 * endpoint without a single compile error. The path is the server's to serve
 * and not to renumber.
 */
export type Application = Returns<'listApplications'>[number];

export type ApplicationCreate = Accepts<'createApplication'>;
export type ApplicationUpdate = Accepts<'updateApplication'>;

/**
 * The five states, closed and **freely traversable**.
 *
 * No transition is forbidden — a company that reopens a closed process is not
 * a data error, and the backend does not argue with somebody about what
 * happened to them. So no control here locks one either.
 *
 * Derived from the generated union rather than listed, so a sixth state added
 * server-side is a typecheck failure at the place that names them.
 */
export type ApplicationStatus = NonNullable<Application['status']>;

export const APPLICATION_STATUSES = [
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
] as const satisfies readonly ApplicationStatus[];

export function listApplications() {
  return api.get<Application[]>('/applications');
}

/**
 * `201` with the row and its `ETag`.
 *
 * The version is also in the body, which is what every write below reads —
 * so nothing here has to keep a header. `status` omitted means `applied` and
 * `appliedAt` omitted means today, which is what somebody who has just
 * pressed the button means.
 */
export function createApplication(body: ApplicationCreate) {
  return api.post<Application>('/applications', body);
}

/**
 * A **partial** edit, and the partiality is the point: moving a row from
 * `applied` to `interview` sends the status and nothing else, so it cannot
 * overwrite a note another tab was editing.
 *
 * **`notes: null` means "leave them alone"**, as everywhere else in this API;
 * emptying them needs `clearNotes: true`. One value cannot mean both.
 *
 * `If-Match` is required (§ 35.6) — a missing one is `428`, a stale one
 * `412`. Neither is a new code.
 */
export function patchApplication(id: string, body: ApplicationUpdate, version: Version) {
  return api.patch<Application>(`/applications/${id}`, body as Record<string, unknown>, {
    version,
  });
}

/**
 * Forgets the record of applying, never the document: the CV is untouched.
 *
 * Guarded by `If-Match` like an edit and for the same reason — a row deleted
 * from a stale screen is a row another tab had just changed.
 */
export function deleteApplication(id: string, version: Version) {
  return api.delete<Returns<'deleteApplication'>>(`/applications/${id}`, { version });
}
