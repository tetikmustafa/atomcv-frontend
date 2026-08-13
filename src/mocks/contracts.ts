/**
 * SCAFFOLDING — delete when `npm run gen:api` works.
 *
 * These types exist only so the mock handlers below can be written before the
 * backend publishes an OpenAPI schema. They are the one sanctioned exception
 * to CLAUDE.md rule 2 ("never hand-write types that mirror backend DTOs").
 *
 * Rules while this file lives:
 *   - Nothing outside `src/mocks/` may import it.
 *   - It is deleted, not migrated, at XI-B.9.2 step 4. Handlers then bind to
 *     the generated `@/types/api`.
 *
 * Shapes follow Bölüm 35.7 (capabilities), 35.3 (job accepted) and 30.6 (SSE
 * events) as literally as the documents allow.
 */

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
 * polling shape is *not* specified — see BACKEND-CONTRACT-GAPS.md item 9.
 * What follows is this repo's proposal, used by the mocks so the reconnect
 * path has something to reconcile against.
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

export type FailedEvent = {
  code: string;
  params?: Record<string, unknown>;
  resolutions?: Array<{ action: string; params?: Record<string, unknown> }>;
};
