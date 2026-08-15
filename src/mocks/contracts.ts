/**
 * SCAFFOLDING — narrowed, not deleted. See below.
 *
 * These types exist so the mock handlers can be written before the backend
 * publishes a schema for the endpoints they cover. They are the one
 * sanctioned exception to CLAUDE.md rule 2 ("never hand-write types that
 * mirror backend DTOs").
 *
 * XI-B.9.2 step 4 says to delete this file once `npm run gen:api` works.
 * `gen:api` now works — and none of it can go yet. The published schema is
 * Stage 1 only: fifteen paths, all profile CRUD plus the synchronous
 * `/generations/general`. Every endpoint mocked here — `/auth/session`, the
 * asynchronous `/generations`, `/jobs/{id}` and its stream — is Stage 2 or 3
 * and has no generated counterpart to bind to. Deleting the file would not
 * remove a mirror, it would replace typed mocks with untyped ones.
 *
 * Rules while it lives, unchanged:
 *   - Nothing outside `src/mocks/` may import it.
 *   - A type goes the moment `gen:api` produces its replacement, one at a
 *     time. Nothing here may describe a Stage 1 endpoint: those are typed
 *     from `@/types/api`.
 *
 * Shapes follow Bölüm 35.7 (capabilities), 35.3 (job accepted) and 30.6 (SSE
 * events) as literally as the documents allow.
 */

import type { ProblemDetail, Resolution } from '@/types/domain';

/** Bölüm 35.7. Server-side truth; the client uses it for UX only. */
export type Capabilities = {
  allowedLanguages: string[];
  allowedTemplates: string[];
  canCustomizeTemplate: boolean;
  canEditAtomControls: boolean;
  canAddAlternatives: boolean;
  canSaveHistory: boolean;
  dailyGenerationQuota: number;
  generationsUsedToday: number;
  dailyProfileQuota: number;
  profilesUsedToday: number;
  maxAtoms: number;
};

export type SessionResponse = {
  authenticated: boolean;
  capabilities: Capabilities;
};

/** Bölüm 35.3. Returned with 202 and a Location header. */
export type JobAccepted = {
  jobId: string;
  status: 'queued';
  streamUrl: string;
};

/**
 * Bölüm 30.6 names the three SSE event types and their payloads. The job
 * contract itself was accepted for Stage 2 in the shape proposed here (EK
 * D.6): `id` on every event, `Last-Event-ID` honoured on reconnect, and
 * `GET /jobs/{id}` as the reconciliation endpoint. The mocks model it so the
 * reconnect path has something to reconcile against before it exists.
 */
export type PhaseEvent = {
  phase: string;
  label: string;
  pct: number;
  detail?: string;
};

export type CompletedEvent = {
  generationId: string;
  pageCount: number;
  matchLevel: 'WEAK' | 'MODERATE' | 'GOOD' | 'STRONG';
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
