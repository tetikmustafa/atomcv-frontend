/**
 * SCAFFOLDING — narrowed, not deleted. See below.
 *
 * These types exist so the mock handlers can be written before the backend
 * publishes a schema for what they cover. They are the one sanctioned
 * exception to CLAUDE.md rule 2 ("never hand-write types that mirror backend
 * DTOs").
 *
 * XI-B.9.2 step 4 said to delete this file once `npm run gen:api` works. The
 * corrected rule is narrower and auditable: **the file empties endpoint by
 * endpoint, type by type** — nothing here may describe something the schema
 * already carries.
 *
 * Stage 2 took `JobAccepted` out: `POST /generations` is published, and
 * `AcceptedJobResponse` is its generated shape.
 *
 * Stage 3 took `Capabilities` and `SessionResponse` out: `GET /auth/session`
 * is published, and `src/lib/api/endpoints/auth.ts` derives both from it.
 * With them went the note explaining why `anonymousExpiresAt` was withheld —
 * the server publishes it now, so the mock sends it.
 *
 * Rules while it lives, unchanged:
 *   - Nothing outside `src/mocks/` may import it.
 *   - A type goes the moment `gen:api` produces its replacement, one at a
 *     time.
 */

import type { ProblemDetail, Resolution } from '@/types/domain';

/**
 * § 30.6's three event payloads.
 *
 * The **endpoint** is published; its payloads are not. `GET /jobs/{id}/stream`
 * answers `text/event-stream`, which openapi-typescript can only render as
 * `unknown`, so there is nothing generated to bind to and deleting these
 * would replace typed mocks with untyped ones rather than remove a mirror.
 *
 * All three were read off the wire, not transcribed from the document, and
 * re-measured on 2026-08-25 after `B-040` and `B-041` answered `F-008` and
 * `F-010`.
 */
export type PhaseEvent = {
  /** Absent while the job is queued: there is no phase to name yet. */
  phase?: string;
  /** A translation key (`generation.phase.*`), never a sentence. */
  label?: string;
  pct: number;
  detail?: string;
};

export type CompletedEvent = {
  generationId: string;
  pageCount: number;
  /** Over the counts, not a percentage — § 23.3 forbids one by name. */
  matchLevel: NonNullable<import('@/types/api').components['schemas']['FitReport']['level']>;
};

/**
 * What an import job says when it finishes (`B-051`).
 *
 * Belongs here for the same reason the three above do — it is an SSE payload,
 * and there is nothing generated to bind to. The difference is that this one
 * has a **published sibling that does not carry it**:
 * `JobStatusResponse` describes only a generation's outcome, so a reload
 * after extraction reaches `GET /jobs/{id}` and learns none of this. Asked as
 * `F-018`; until it is answered, this type is the only description there is.
 */
export type ImportCompletedEvent = {
  profileId: string;
  sectionCount: number;
  atomCount: number;
  /**
   * How many things the extraction was unsure about. A **count**, and that
   * is the whole difficulty: § 31.6 wants the problematic sections opened and
   * critical warnings to block "Confirm", and neither can be done from a
   * number. Also `F-018`.
   */
  warningCount: number;
  detectedLanguage: string;
};

/**
 * The in-flight half of "the same error over two transports". It borrows the
 * envelope's own vocabulary rather than restating it with `string`, so a mock
 * cannot emit a code or an action the error renderer would not recognise.
 */
export type FailedEvent = {
  code: ProblemDetail['code'];
  params?: Record<string, unknown>;
  resolutions?: Resolution[];
};
