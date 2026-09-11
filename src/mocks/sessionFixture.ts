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
 * What the registry actually holds (`B-046`, then `B-090` and `B-092`).
 *
 * It was one for two stages, and § 35.7's three-template example was older
 * than the registry — listing a template that cannot be rendered offers a
 * choice that fails at generation time. Stage 4 landed the other two, so the
 * list is three again for a different reason than the example gave.
 *
 * **Ordered, and it stays ordered.** The list is the server's; a screen
 * sorting it would be inventing an order of its own.
 */
export const TEMPLATES = ['classic', 'compact', 'modern'];

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

/**
 * The unsubscribe token an email would have carried (§ 57.7).
 *
 * Opaque and random on the server, and one live value is enough here: what
 * the page has to survive is **any other token**, because a token that is not
 * live is answered `204` exactly like one that is. There is deliberately no
 * way to tell them apart, so there is nothing else to fixture.
 */
export const UNSUBSCRIBE_TOKEN = '2f2c6d0e-0f6f-4a3a-9d1c-6b5a1d9a8f11';

/**
 * `users.lifecycle_emails`, which defaults to on.
 *
 * Its own state rather than a corner of `session`: it survives a sign-out the
 * way the column does, and the unsubscribe endpoint writes it without a
 * session at all.
 *
 * **Persisted in the browser as well as held in the module**, and the reason
 * is the same one `MOCK_SESSION_KEY` exists for: module state lives as long
 * as the page, and the journey worth testing crosses a navigation — turn the
 * emails off from an inbox link, then open the settings screen and see the
 * switch agree. A value that reset on reload would make the mock answer
 * differently from anything with a database behind it.
 */
const EMAILS_KEY = 'atomcv-mock-lifecycle-emails';

let optionalEmails = true;

export function lifecycleEmails(): boolean {
  const stored = readFlag(EMAILS_KEY);
  if (stored) return stored === 'on';

  return optionalEmails;
}

export function setLifecycleEmails(on: boolean) {
  optionalEmails = on;
  writeFlag(EMAILS_KEY, on ? 'on' : 'off');
}

/**
 * Storage, guarded at every access: a mock that throws takes down the page it
 * was meant to serve, and storage can be blocked outright.
 */
function readFlag(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Blocked storage. The module flag still carries the state for anything
    // running in this same process.
  }
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

/** Reads and writes it through the same guarded pair as everything else here. */
const storedSession = {
  read: () => readFlag(MOCK_SESSION_KEY),
  write: (value: string | null) => writeFlag(MOCK_SESSION_KEY, value),
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
  // The column defaults to on, and a test that turned it off would hand the
  // next one a switch already in the wrong position.
  optionalEmails = true;
  writeFlag(EMAILS_KEY, null);
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
      canWriteCoverLetter: true,
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
    // `B-085`: its own flag rather than something read off `canSaveHistory`.
    // Every `feature` a `FEATURE_REQUIRES_ACCOUNT` can name has a boolean
    // here, which is what lets a screen close the door before it is tried.
    canWriteCoverLetter: false,
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
