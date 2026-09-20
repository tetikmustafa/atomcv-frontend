/**
 * Following a job.
 *
 * Two ways in, and they are not alternatives: the stream is how progress
 * arrives, and `GET /jobs/{id}` is what answers when the stream ends without
 * saying how things turned out. A spinner over work that already finished is
 * the one outcome this subsystem refuses to produce.
 */

import { API_BASE_URL, api } from '../client';
import type { Returns } from '../operations';
import type { ImportWarning } from '@/types/domain';

/**
 * Wildcard media type, as with the accepted-job body — with one narrowing.
 *
 * `warnings[]` carries a code the schema publishes as a closed enum and the
 * server stores as a `String` (`B-069`), so the generated union is a snapshot
 * of the day `gen:api` last ran rather than a promise. `ImportWarning`
 * re-opens it; the alternative is a client that drops a warning it does not
 * recognise, and a dropped warning makes `warningCount` a lie.
 */
export type JobStatus = Omit<Returns<'readJob', '*/*'>, 'warnings'> & {
  warnings?: ImportWarning[];
};

/**
 * The terminal statuses.
 *
 * `cancelled` used to be listed here as a third one, defensively: it was in
 * the schema's enum, nothing produced it, and a job that started arriving
 * cancelled would otherwise have hung the stream. It left the wire with
 * `B-116` — the only method that could write it had no caller but its own
 * test, and no endpoint cancels anything — so the defence now guards a value
 * the server cannot send, and a branch no request reaches is a branch nothing
 * measures.
 *
 * **Cancelling is a feature rather than an omission**, and the day it lands
 * the value comes back with it. This list is derived from the published enum
 * rather than written out, so that day is a typecheck failure here and not a
 * stream that waits forever.
 */
const TERMINAL = ['completed', 'failed'] as const;

/**
 * Every status is either terminal or in flight. A third kind is a value
 * nobody has decided about, and the decision it needs is exactly the one
 * `cancelled` needed: does the stream stop on it?
 *
 * A type rather than a second array, because nothing reads the in-flight
 * names at runtime — the code asks `isTerminal` and takes the other branch.
 */
type InFlight = 'queued' | 'running';

type Unclassified = Exclude<NonNullable<JobStatus['status']>, (typeof TERMINAL)[number] | InFlight>;
const _everyStatusIsClassified: Unclassified extends never ? true : Unclassified = true;
void _everyStatusIsClassified;

export function isTerminal(status: JobStatus | undefined): boolean {
  return status !== undefined && TERMINAL.includes(status.status as (typeof TERMINAL)[number]);
}

export function getJob(jobId: string) {
  return api.get<JobStatus>(`/jobs/${jobId}`);
}

/**
 * Where to point an `EventSource`.
 *
 * The 202 hands back a `streamUrl` and that is the one to use when it is in
 * hand. This exists for the other case — a result screen opened from a
 * reload, holding a job id and nothing else.
 */
export function jobStreamUrl(jobId: string) {
  return `${API_BASE_URL}/jobs/${jobId}/stream`;
}
