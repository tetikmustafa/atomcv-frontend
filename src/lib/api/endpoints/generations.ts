/**
 * The Stage 2 generation API.
 *
 * Two calls and nothing else: starting one, and downloading what it made.
 * There is no `GET /generations/{id}` to read a finished generation with —
 * the resource map names one (§ 35.2) but the schema does not publish it, so
 * everything the result screen knows arrives on the stream (`F-008`).
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
 * The finished PDF, re-rendered from the stored snapshot rather than from the
 * profile: editing a bullet afterwards does not change a CV that has already
 * been sent. When the snapshot is gone the answer is `410`
 * `GENERATION_ARTIFACT_EXPIRED`, which is why this is a fetch and not a link.
 */
export function downloadGeneration(generationId: string) {
  return api.getFile(`/generations/${generationId}/download`);
}
