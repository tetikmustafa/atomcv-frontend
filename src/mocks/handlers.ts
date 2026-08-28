import { http, HttpResponse } from 'msw';
import type { Capabilities, Session } from '@/lib/api/endpoints/auth';
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
/** Two hours from the last activity, and this response is activity (§ 35.7). */
const ANONYMOUS_TTL_MS = 2 * 60 * 60 * 1000;

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
    // Computed per request, which is the behaviour rather than the value:
    // the TTL **slides** with activity (§ 35.7), so a client that caches this
    // counts down to a moment that has already moved. A frozen instant would
    // let a screen built on a stale read pass every test.
    anonymousExpiresAt: new Date(Date.now() + ANONYMOUS_TTL_MS).toISOString(),
  };
}

export const handlers = [
  ...profileHandlers,

  /**
   * Anonymous by default. The UI must gate itself on this object rather than
   * on hardcoded assumptions about what anonymous users can do.
   */
  http.get('*/api/v1/auth/session', () =>
    HttpResponse.json<Session>(
      {
        authenticated: false,
        capabilities: anonymousCapabilities(),
      },
      // The header the real endpoint sends (`B-046`). It changes nothing in
      // MSW, which never consults a cache — it is here so the mock does not
      // quietly describe a more cacheable endpoint than the one it stands in
      // for.
      { headers: { 'Cache-Control': 'no-store' } },
    ),
  ),

  ...generationHandlers,
];
