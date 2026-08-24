/**
 * The Stage 2 generation API.
 *
 * Starting one, reading it back, and downloading what it made.
 *
 * `GET /generations/{id}` is what the result screen was waiting for (`B-041`):
 * before it, everything the screen knew arrived on the stream, so a reload
 * left it with a page and no facts on it.
 */

import { api } from '../client';
import type { Accepts, Returns } from '../operations';

/**
 * The body, flat rather than nested.
 *
 * § 35.3 still shows `directives` and `options`; the schema is what the
 * server accepts, and it wins (`F-009`). `acknowledgePreflight` is required
 * here because the generator says so — the server defaults it to `false`, but
 * a caller that means "the user insisted" should have to say it.
 */
export type GenerationRequest = Accepts<'generate'>;

/** Wildcard media type: springdoc publishes the 202 body without a `produces`. */
export type AcceptedJob = Returns<'generate', '*/*'>;

/**
 * Starts a generation. **Answers 202**, not a document — everything after
 * this happens on the job.
 *
 * `idempotencyKey` is the double-submit defence Stage 1 did not have (§ 30.7).
 * A disabled button only covers the request that is already in flight; a key
 * covers the one that was retried after a dropped connection, which is the
 * case that actually produces two CVs. Generate it once per *attempt the user
 * meant*, not once per call: retrying with a fresh key is a second
 * generation, which is the thing being prevented.
 */
export function startGeneration(body: GenerationRequest, idempotencyKey: string) {
  return api.post<AcceptedJob>('/generations', body, { idempotencyKey });
}

/**
 * JSON, unlike its siblings on this endpoint: this operation declares what it
 * produces, so the default media type is the right one. Getting it wrong is
 * not subtle — `Returns` resolves to `never` and every field access fails.
 */
export type Generation = Returns<'read'>;

/**
 * Faz F's coverage report (§ 23.3).
 *
 * **Counts, never a percentage.** The measurement compares skill names, and a
 * figure to the decimal place invites the reader to treat it as a hiring
 * probability — which is why the section forbids one by name, and why nothing
 * in the client derives a ratio from these numbers.
 *
 * `level` is a closed vocabulary the server computes over the counts. It is
 * left as the generated enum rather than re-opened: unlike `ResolutionAction`,
 * a level this build has never seen has no button to render and no way to be
 * acted on, and the counts beside it still say everything true.
 */
export type FitReport = NonNullable<Generation['fitReport']>;

/**
 * One finished generation. Absent `fitReport` means general mode — there was
 * no posting to be relevant to, and a row of zeroes would read as a bad match
 * rather than as a different question.
 */
export function getGeneration(generationId: string) {
  return api.get<Generation>(`/generations/${generationId}`);
}

/**
 * The finished PDF, re-rendered from the stored snapshot rather than from the
 * profile: editing a bullet afterwards does not change a CV that has already
 * been sent. When the snapshot is gone the answer is `410`
 * `GENERATION_ARTIFACT_EXPIRED`, which is why this is a fetch and not a link.
 */
export function downloadGeneration(generationId: string) {
  return api.getFile(`/generations/${generationId}/download`);
}
