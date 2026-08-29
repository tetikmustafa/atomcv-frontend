/**
 * Which sign-in outcomes have something to say (§ 41.3.3, `B-054`).
 *
 * Shared by both ways in, because both carry the same vocabulary: the magic
 * link gets it in the `200` body, OAuth gets it as `?profile=…` on the
 * landing URL — a redirect has no body for the client to read.
 */

import type { ProfileUpgrade } from '@/lib/api/endpoints/auth';

/**
 * The three that get a sentence. `none` is the fourth and is deliberately
 * absent: most sign-ins are that one, and a confirmation nobody needed is a
 * step added to the most-walked path in the product.
 *
 * `satisfies` rather than a plain annotation, so the literal types survive to
 * become `DescribedUpgrade` while a value renamed on the wire still stops the
 * build here.
 */
const DESCRIBED = [
  'upgraded',
  'kept_existing',
  'unavailable',
] as const satisfies readonly ProfileUpgrade[];

export type DescribedUpgrade = (typeof DESCRIBED)[number];

/**
 * The outcome to show, or `null` for "carry on without saying anything".
 *
 * The input is typed loosely on purpose. From OAuth it is a raw query
 * parameter — a string the user can edit — and from the magic link it is a
 * field the schema marks optional, so an older server or a truncated body
 * both arrive as `undefined`.
 *
 * **An unrecognised value says nothing**, and that is a decision rather than
 * an oversight. A fifth outcome would arrive here with no way to tell whether
 * it is good news or bad, and both of the sentences we already have make a
 * claim: one says work was carried over, another says it was lost. Guessing
 * either would be worse than the silence, and the cookie — the part that
 * actually signs the person in — is unaffected.
 */
export function describableUpgrade(raw: string | null | undefined): DescribedUpgrade | null {
  if (!raw) return null;

  return (DESCRIBED as readonly string[]).includes(raw) ? (raw as DescribedUpgrade) : null;
}
