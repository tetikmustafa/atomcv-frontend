/**
 * Who the mock says is here, and what they may do.
 *
 * Two capability sets rather than one, because § 35.7 publishes two and the
 * differences between them are what the UI has to survive: an account has no
 * `maxAtoms` and no `anonymousExpiresAt` **at all**, so a screen that reads
 * either without checking is a screen this fixture can break.
 */

import { ACCOUNT_QUOTA, generations, QUOTA } from './generationFixture';
import type { Capabilities, Session } from '@/lib/api/endpoints/auth';

/**
 * What the registry actually holds today (`B-046`).
 *
 * § 35.7's example lists three, and that example is older than the registry.
 * Listing a template that cannot be rendered offers a choice that fails at
 * generation time, so the mock publishes the real one.
 */
const TEMPLATES = ['classic'];

/** Two hours from the last activity, and answering this counts (§ 35.7). */
const ANONYMOUS_TTL_MS = 2 * 60 * 60 * 1000;

export const session = { authenticated: false };

/**
 * How a **browser** says who it is, since it cannot reach the module state
 * above: Playwright runs in its own process, and MSW's handlers run in the
 * page.
 *
 * A flag rather than a fake sign-in endpoint. Inventing an endpoint the real
 * backend does not have would put a shape in the handlers that nothing on the
 * wire matches, which is the one thing these mocks are not allowed to do —
 * they stand in for the API, they do not extend it. Set it with
 * `page.addInitScript` before the first navigation.
 */
export const MOCK_SESSION_KEY = 'atomcv-mock-session';

function isAuthenticated(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const flag = window.localStorage.getItem(MOCK_SESSION_KEY);
      // Only when it is actually set. Absent means "ask the module", which is
      // what jsdom does — `signIn()` there writes no storage.
      if (flag) return flag === 'account';
    } catch {
      // Blocked storage. Fall through rather than fail: a mock that throws
      // takes down the page it was meant to serve.
    }
  }

  return session.authenticated;
}

export function resetSessionFixture() {
  session.authenticated = false;
}

/** For Vitest and the dev harness. There is no sign-in endpoint mocked yet. */
export function signIn() {
  session.authenticated = true;
}

export function signOut() {
  session.authenticated = false;
}

/**
 * The limits in force for whoever is here.
 *
 * One function so `capabilities` and `/account/usage` cannot disagree: a
 * capability screen that contradicts the 429 the user is about to get is
 * worse than no capability screen (§ 35.7).
 */
export function currentQuota() {
  return isAuthenticated() ? ACCOUNT_QUOTA : QUOTA;
}

export function currentCapabilities(): Capabilities {
  const quota = currentQuota();

  const shared = {
    allowedTemplates: TEMPLATES,
    dailyGenerationQuota: quota.generation,
    generationsUsedToday: generations.usage.generation,
    dailyProfileQuota: quota.profile_extract,
    profilesUsedToday: generations.usage.profile_extract,
  };

  if (isAuthenticated()) {
    return {
      ...shared,
      allowedLanguages: ['en', 'tr'],
      canCustomizeTemplate: true,
      canEditAtomControls: true,
      canAddAlternatives: true,
      canSaveHistory: true,
      // Absolute instant for an account, `null` anonymously — the anonymous
      // allowance is counted per address (§ 44.1), so there is no per-session
      // moment it renews at.
      quotaResetsAt: endOfUtcDay(),
      // `maxAtoms` and `anonymousExpiresAt` are **not here**, and their
      // absence is the point: `null` would still be a value the client could
      // draw a bar against.
    };
  }

  return {
    ...shared,
    allowedLanguages: ['en'],
    canCustomizeTemplate: false,
    canEditAtomControls: false,
    canAddAlternatives: false,
    canSaveHistory: false,
    maxAtoms: 60,
    quotaResetsAt: null,
    // Recomputed per call, which is the behaviour and not just the value: a
    // frozen instant would let a screen built on a stale read pass.
    anonymousExpiresAt: new Date(Date.now() + ANONYMOUS_TTL_MS).toISOString(),
  };
}

export function currentSession(): Session {
  return { authenticated: isAuthenticated(), capabilities: currentCapabilities() };
}

/** The quota day turns at UTC midnight (`F-007`), not at the reader's. */
function endOfUtcDay() {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight.toISOString();
}
