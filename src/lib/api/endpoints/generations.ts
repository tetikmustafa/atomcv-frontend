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
 *
 * `challengeToken` is in here too, and is **not** an addition of ours: it was
 * published all along (`B-086`), and the intersection type that stood here
 * for a day existed only because `api.d.ts` had been generated against a
 * backend older than the field. Regenerating was the whole fix. § 35.7.4
 * requires the token of a caller **without an account** — missing or blank is
 * `403 CHALLENGE_FAILED` — and ignores one an account sends, because signing
 * in already answered a challenge (§ 40.4.1).
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
 * The two formats the endpoint serves (`B-094`).
 *
 * **Not derived from the schema**, because there is nothing there to derive
 * from: `format` is published as a bare `string` with a default, so the
 * generated type says nothing a union here would not say better. § 35.3's map
 * lists a third value, `source`, and asking for it is `400 VALIDATION_FAILED`
 * today — nothing serves it. It is left out rather than offered and refused:
 * a "download the source" button that answers with an error panel is worse
 * than one that was never drawn.
 */
export type DownloadFormat = 'pdf' | 'docx';

/**
 * The finished document, re-rendered from the stored snapshot rather than
 * from the profile: editing a bullet afterwards does not change a CV that has
 * already been sent. When the snapshot is gone the answer is `410`
 * `GENERATION_ARTIFACT_EXPIRED`, which is why this is a fetch and not a link.
 *
 * **`format` is omitted for PDF rather than stated.** The server defaults to
 * it, so every call that was written before this parameter existed still
 * means what it meant — and a query string that carries only what was chosen
 * is the one that cannot disagree with the default.
 *
 * The page count promised on screen is the **PDF's**. Word sets the same
 * atoms in whatever room its own fonts take (§ 22.6), so a one-page CV can
 * run over there; the backend claims no page count for DOCX, and neither may
 * the screen.
 */
export function downloadGeneration(generationId: string, format: DownloadFormat = 'pdf') {
  const query = format === 'pdf' ? '' : `?format=${format}`;

  return api.getFile(`/generations/${generationId}/download${query}`);
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

/* --------------------------------- edits -------------------------------- */

/**
 * Faz G, both halves (§ 24, `B-088` and `B-089`).
 *
 * **An edit applies to the selection state, never to the rendered
 * document**, which is what keeps the page limit true after twenty of them:
 * each edit goes back through the selection that made the promise. So this is
 * the one place on the result screen where "edits are not local UI state"
 * bites hardest — the answer is a **new generation**, not a changed one.
 *
 * Both endpoints answer `202` with a job on the same stream a generation
 * uses. The edited generation stays, marked `superseded`, and remains
 * readable and downloadable: the promise that a CV already sent to an
 * employer still exists rests on that.
 *
 * `202` here is `application/json`, unlike `POST /generations` — which
 * declares no `produces` and is published under the wildcard. Naming the
 * wrong one resolves to `never` rather than to a wrong field, which is the
 * whole reason `Returns` takes the media type.
 */
export type AcceptedEdit = Returns<'edit'>;

export type SelectionEdit = Accepts<'editSelection'>;

/**
 * Keeping or dropping atoms by hand.
 *
 * **Costs nothing.** No model call and nothing off the day's allowance — the
 * answer is deterministic, so it is a compilation and no more. A screen that
 * warns about the quota here would be warning about a charge that does not
 * happen.
 *
 * **No screen calls this yet, and the gap is the server's** (`F-031`).
 * Drawing a toggle per bullet needs to know which atoms this generation
 * weighed and which of them reached the page, and nothing publishes that:
 * `GET /generations/{id}` carries the fit report and the letter, not the
 * selection. An atom this generation never weighed is a `400` rather than a
 * no-op, so a screen built from the profile's atoms instead would offer
 * buttons that cannot be pressed.
 */
export function editSelection(generationId: string, body: SelectionEdit) {
  return api.post<AcceptedEdit>(`/generations/${generationId}/selection`, body);
}

export type InstructionEdit = Accepts<'edit'>;

/**
 * The same change, asked for in a sentence.
 *
 * **This one costs a generation** off the day's allowance, because it is a
 * model call — and that is the difference the screen has to say out loud.
 * It is refunded when the sentence named no line, which arrives as
 * `422 EDIT_NOT_UNDERSTOOD`.
 *
 * **That refusal is not a fault and will be common.** The model is shown the
 * lines numbered and never their ids, so it cannot name a bullet that does
 * not exist; when it can match nothing, the server would rather do nothing
 * than delete the wrong line, because the reader may not notice. The message
 * for it has to say what the endpoint *can* do, or the refusal is a dead end.
 *
 * No `Idempotency-Key`: the endpoint does not declare one. A double press
 * makes a second edit of the same generation, and the second is answered
 * `409 GENERATION_SUPERSEDED` — which is the collision being prevented,
 * arriving as an error rather than as two CVs.
 */
export function editByInstruction(generationId: string, body: InstructionEdit) {
  return api.post<AcceptedEdit>(`/generations/${generationId}/edits`, body);
}

/**
 * § 24.2's limit, as the schema states it.
 *
 * Hand-written because `maxLength` does not survive into a TypeScript type,
 * and the alternative is a textarea that lets somebody write six hundred
 * characters and then answers `400`. The server is still the one enforcing
 * it; this only keeps the reader from reaching that wall.
 */
export const INSTRUCTION_MAX_LENGTH = 500;

/* ------------------------------- feedback ------------------------------ */

/**
 * A verdict on one generation (§ 48.4, `B-058`).
 *
 * **Nothing is narrowed here any more, and that is the point.** `rating` used
 * to arrive as the string literals `"1" | "-1"` while the same schema said
 * `format: int32`, so this carried an `Omit` and put the numbers back. The
 * cause was swagger's `allowableValues` being a `String[]` regardless of the
 * property's type; the backend changed it to a real `enum: [1, -1]`
 * (`B-065`), the generated type now says what the wire says, and the
 * narrowing came off. What the client sends never changed.
 */
export type FeedbackRequest = Accepts<'feedback'>;

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

/* -------------------------------- history ------------------------------ */

export type GenerationPage = Returns<'list'>;
export type GenerationSummary = NonNullable<GenerationPage['items']>[number];

/**
 * The generations this account has made, newest first (`B-066`).
 *
 * `capabilities.canSaveHistory` says they are kept; until this landed there
 * was nowhere to read them, which is what `F-020` was about.
 *
 * **Cursor, not offset.** The list grows from the top, so a second page taken
 * after a new generation landed would repeat one row and hide another. Pass a
 * page's `nextCursor` back as `cursor`; **its absence is the end** — an empty
 * `items` would be one page too late to notice. The value is opaque: the
 * server's to read and ours to echo, so nothing here parses it.
 *
 * **`total` counts the account, not the page**, and that is the field the
 * deletion screen needs: a number arrived at by walking pages would be a
 * different number by the time the walk finished.
 */
export function listGenerations(params: { cursor?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit !== undefined) query.set('limit', String(params.limit));

  const search = query.toString();
  return api.get<GenerationPage>(`/generations${search ? `?${search}` : ''}`);
}
