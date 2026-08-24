import { http, HttpResponse } from 'msw';
import type { Capabilities, SessionResponse } from './contracts';
import { generationHandlers } from './generationHandlers';
import { generations, QUOTA } from './generationFixture';
import { profileHandlers } from './profileHandlers';

/**
 * Mock API surface. One set of handlers, shared by the browser worker, Vitest
 * and Playwright — so a behaviour verified in a test is the same one seen in
 * the browser.
 *
 * These encode *behaviour*, not sample payloads. The point is to exercise the
 * paths that are easy to get wrong: capability-gated UI, a preflight error
 * that arrives with resolutions, and a job whose progress streams in.
 *
 * Paths use a `*` origin prefix so the same handler matches a relative request
 * in the browser and an absolute one under Node.
 *
 * Only `/auth/session` lives here now. The profile and generation surfaces
 * keep state, and each has its own file for it.
 */

/**
 * § 9 (Stage 0): narrower in scope, never lower in quality.
 *
 * Built per request rather than frozen at module scope, because the counters
 * move. `capabilities` and `/account/usage` report the same quota, and they
 * read it from the same place — two sources for one limit is how a usage
 * screen ends up disagreeing with the 429 that fired it.
 */
function anonymousCapabilities(): Capabilities {
  return {
    allowedLanguages: ['en'],
    allowedTemplates: ['classic', 'modern', 'compact'],
    canCustomizeTemplate: false,
    canEditAtomControls: false,
    canAddAlternatives: false,
    canSaveHistory: false,
    dailyGenerationQuota: QUOTA.generation,
    generationsUsedToday: generations.usage.generation,
    dailyProfileQuota: QUOTA.profile_extract,
    profilesUsedToday: generations.usage.profile_extract,
    maxAtoms: 60,
  };
}

export const handlers = [
  ...profileHandlers,

  /**
   * Anonymous by default. The UI must gate itself on this object rather than
   * on hardcoded assumptions about what anonymous users can do.
   */
  http.get('*/api/v1/auth/session', () =>
    HttpResponse.json<SessionResponse>({
      authenticated: false,
      capabilities: anonymousCapabilities(),
    }),
  ),

  ...generationHandlers,
];
