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

/**
 * The covering letter for a generation that already exists (§ 34, `B-056`).
 *
 * **Off the main path on purpose.** It is a second LLM call and most people
 * want a CV, so `POST /generations` defaults `coverLetter` to `false` and
 * this is how it is asked for afterwards — or asked for again.
 *
 * **Each press replaces the stored letter.** Trying another draft leaves one
 * letter, not three; the screen has nothing to reconcile and there is no
 * history to render.
 *
 * **It can refuse, and that refusal is not a fault.** A letter has no
 * original to fall back on — in the CV, a rejected sentence is replaced by
 * the person's own wording, and here there is nothing to print instead — so a
 * draft that overstates is thrown away and reported as
 * `422 COVER_LETTER_REJECTED`. Another press is a different draft.
 */
export type CoverLetterRequest = Accepts<'coverLetter'>;

export function regenerateCoverLetter(generationId: string, body: CoverLetterRequest) {
  return api.post<Returns<'coverLetter'>>(
    `/generations/${generationId}/cover-letter/regenerate`,
    body,
  );
}

/* ------------------------------- feedback ------------------------------ */

/**
 * A verdict on one generation (§ 48.4, `B-058`).
 *
 * **`rating` is narrowed, and it is a generator artefact rather than a
 * disagreement with the contract.** The schema declares `format: int32` and
 * documents "1 for good, -1 for bad"; `FeedbackResponse.rating` comes back as
 * a `number`. openapi-typescript renders the request's enum as the string
 * literals `"1" | "-1"` anyway, and sending a string for a field the server
 * reads as an integer is the kind of thing that works until it does not.
 *
 * Derived rather than restated, so a real change to the shape still breaks
 * the build here (`Omit` plus the narrowing, as `domain.ts` does).
 */
export type FeedbackRequest = Omit<Accepts<'feedback'>, 'rating'> & { rating: 1 | -1 };

export type Feedback = Returns<'feedback'>;

/**
 * Records it, or changes it.
 *
 * **One verdict per generation.** Pressing the other thumb is changing your
 * mind: no second row opens, the existing one is updated. So the screen shows
 * the **current selection** rather than thanking anyone for having sent
 * something — the reader can see what they said and say otherwise.
 *
 * `contentGranted` is § 48.4's consent and the one thing here that needs
 * care: everything else in this product is diagnosed from shapes — character
 * counts, line counts, render cost — and this is the single door to the
 * content itself. Ticking it opens 48 hours; sending `false` **revokes**,
 * which is why every call states it rather than leaving it out.
 */
export function submitFeedback(generationId: string, body: FeedbackRequest) {
  return api.post<Feedback>(`/generations/${generationId}/feedback`, body);
}
