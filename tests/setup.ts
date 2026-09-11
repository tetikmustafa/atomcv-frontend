import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { server } from '@/mocks/node';
import { installEventSource, resetEventSource } from './support/eventSource';
import { resetApplications } from '@/mocks/applicationHandlers';
import { resetGenerationFixture } from '@/mocks/generationFixture';
import { resetProfileFixture } from '@/mocks/profileFixture';
import { resetSessionFixture } from '@/mocks/sessionFixture';
import { resetAuthFixture } from '@/mocks/authFixture';

expect.extend(toHaveNoViolations);

/**
 * jsdom implements no layout, so it ships no `ResizeObserver`. Radix reaches
 * for one in every primitive that measures itself — Slider is the first, and
 * it throws during the layout effect, which fails the whole render rather
 * than the one measurement.
 *
 * A stub is the right answer rather than a real polyfill: there are no boxes
 * to observe in jsdom, so a working implementation would report zero sizes
 * and be no more truthful than this. Anything that genuinely depends on
 * measured layout belongs in the Playwright suite, in a browser.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/**
 * `FormData`, `File` and `Blob` come from Node, not from jsdom.
 *
 * In a browser the file you pick and the `fetch` that uploads it are one
 * implementation. Here they are two — jsdom supplies the file APIs, Node
 * supplies `fetch` — and the seam is not cosmetic. Measured, in this order:
 *
 * - jsdom's `FormData.append` **refuses** a Node `Blob` outright, and
 *   silently stringifies a Node `File` given two arguments. The part then
 *   arrives at the handler as the text `[object File]`.
 * - a jsdom `File` inside a body Node has to serialise produces a request
 *   whose stream never ends. `request.text()` does not resolve, so the
 *   failure shows up as a test timeout with nothing to point at.
 *
 * So all three are replaced together: a half-swap is what produces the first
 * failure. `FormData` has no module to import it from, and reaching into
 * `undici` — a transitive dependency of MSW — would tie the suite to
 * somebody else's dependency tree. Asking a `Response` to parse a body is the
 * same class by construction, from the implementation that will actually
 * parse the upload.
 */
const nodeFormData = await new Response('a=b', {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
}).formData();

globalThis.FormData = nodeFormData.constructor as typeof globalThis.FormData;
globalThis.Blob = NodeBlob as unknown as typeof globalThis.Blob;
globalThis.File = NodeFile as unknown as typeof globalThis.File;

/**
 * jsdom ships no `EventSource` either, and § 36.4 specifies it for progress.
 * The double is a real client over `fetch`, so what it reads is what MSW
 * serves — the same frames the browser gets.
 */
installEventSource();

/**
 * The same handlers the browser worker uses. A behaviour asserted here is the
 * behaviour seen in development, which is the whole reason MSW was chosen
 * over a test-only fake.
 *
 * `error` rather than `warn` on an unhandled request: a request escaping to
 * the network in a unit test is a bug in the test, not background noise.
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
  // The profile handlers keep state, because optimistic concurrency cannot be
  // mocked without it. Left alone, one test's writes would set the next
  // test's starting versions.
  resetProfileFixture();
  // Same reason, different counter: a quota the previous test used up would
  // fail the next one on a limit it never asked for.
  resetGenerationFixture();
  // Fourth: rows one test recorded would be there for the next one to find,
  // and "the list is empty" is a state several of them assert.
  resetApplications();
  // A test that signed in would otherwise hand the next one an account, and
  // the capability gates would pass for the wrong reason.
  resetSessionFixture();
  // Third counter, same hazard: three magic links asked for in one test would
  // start the next one at its rate limit, and a spent selector would make an
  // ordinary sign-in look like an invalid link.
  resetAuthFixture();
  resetEventSource();
  cleanup();
});

afterAll(() => server.close());
