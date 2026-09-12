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
 * The terminal statuses. `cancelled` is in the schema's enum and nothing
 * produces it yet; it is listed here rather than left out so that a job which
 * starts arriving cancelled stops the stream instead of hanging on it.
 */
const TERMINAL = ['completed', 'failed', 'cancelled'] as const;

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
