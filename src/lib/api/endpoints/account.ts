/**
 * What the account has used today.
 *
 * A bare array, and **both metrics are always in it** — a missing entry means
 * "no such metric", never "zero used" (`B-039`). `resetsAt` is an absolute
 * instant rather than an hour: the day boundary is UTC, which is 03:00 in
 * Turkey, and the sentence around it is written in the user's own locale
 * (`F-007`).
 */

import { api } from '../client';
import type { Returns } from '../operations';

export type Usage = Returns<'usage', '*/*'>[number];

/** The metrics the server counts. Closed, and the client renders each by name. */
export type UsageMetric = 'generation' | 'profile_extract';

export function getUsage() {
  return api.get<Usage[]>('/account/usage');
}
