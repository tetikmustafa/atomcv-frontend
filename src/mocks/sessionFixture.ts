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

/**
 * § 35.7's ceiling on an anonymous profile, and § 35.7.2's newly enforced one
 * (`B-081`): the sixty-first atom is `422 ATOM_LIMIT_EXCEEDED`.
 */
const ANONYMOUS_MAX_ATOMS = 60;

/**
 * The ceiling in force, so a test can reach it.
 *
 * A knob rather than sixty rows of fixture, for the reason `requireChallenge`
 * is one: what has to be exercised is the **refusal** and the sentence built
 * out of `limit` and `current`, and building fifty-nine atoms to get there
 * would test the fixture rather than the screen. The handler still reads the
 * same number `capabilities` publishes, so the two cannot disagree.
 */
let maxAtoms = ANONYMOUS_MAX_ATOMS;

export function limitAtomsTo(limit: number) {
  maxAtoms = limit;
}

/** The ceiling for whoever is here — `undefined` for an account, which has none. */
export function currentMaxAtoms(): number | undefined {
  return isAccount() ? undefined : maxAtoms;
}

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

/**
 * Reads and writes the flag where it exists, and does nothing where it does
 * not.
 *
 * Every access is guarded: a mock that throws takes down the page it was
 * meant to serve, and storage can be blocked outright.
 */
const storedSession = {
  read(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(MOCK_SESSION_KEY);
    } catch {
      return null;
    }
  },

  write(value: string | null) {
    if (typeof window === 'undefined') return;
    try {
      if (value === null) window.localStorage.removeItem(MOCK_SESSION_KEY);
      else window.localStorage.setItem(MOCK_SESSION_KEY, value);
    } catch {
      // Blocked storage. The module flag below still carries the state for
      // anything running in this same process.
    }
  },
};

/**
 * Whether the caller is an account, from wherever this process can see it.
 *
 * Exported because a handler that asks the module flag directly is wrong in a
 * browser: Playwright can only speak through `localStorage`, and the import
 * handler read `session.authenticated` at first — which was true under Vitest
 * and false in the browser, so `409 PROFILE_ALREADY_EXISTS` never fired
 * there. Everything that needs the answer goes through here.
 */
export function isAccount(): boolean {
  // The flag wins where it is set, because the browser has no other way to
  // say who it is. Absent means "ask the module", which is the Node path.
  const flag = storedSession.read();
  if (flag) return flag === 'account';

  return session.authenticated;
}

export function resetSessionFixture() {
  session.authenticated = false;
  storedSession.write(null);
  maxAtoms = ANONYMOUS_MAX_ATOMS;
}

/**
 * Signs the mock caller in or out.
 *
 * **Both halves, always.** `signOut()` used to set the module flag alone,
 * which was enough while nothing in the browser could sign in: the storage
 * flag was written once by `addInitScript` and never contradicted. It is
 * contradicted now — a sign-out that left `account` in storage would answer
 * the very next `/auth/session` with the account that was just signed out of,
 * and the button would look broken while the request behind it worked.
 */
export function signIn() {
  session.authenticated = true;
  storedSession.write('account');
}

export function signOut() {
  session.authenticated = false;
  storedSession.write('anonymous');
}

/**
 * The limits in force for whoever is here.
 *
 * One function so `capabilities` and `/account/usage` cannot disagree: a
 * capability screen that contradicts the 429 the user is about to get is
 * worse than no capability screen (§ 35.7).
 */
export function currentQuota() {
  return isAccount() ? ACCOUNT_QUOTA : QUOTA;
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

  if (isAccount()) {
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
    maxAtoms,
    quotaResetsAt: null,
    // Recomputed per call, which is the behaviour and not just the value: a
    // frozen instant would let a screen built on a stale read pass.
    anonymousExpiresAt: new Date(Date.now() + ANONYMOUS_TTL_MS).toISOString(),
  };
}

export function currentSession(): Session {
  return { authenticated: isAccount(), capabilities: currentCapabilities() };
}

/** The quota day turns at UTC midnight (`F-007`), not at the reader's. */
function endOfUtcDay() {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight.toISOString();
}
