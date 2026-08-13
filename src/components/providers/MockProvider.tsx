'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Both halves are inlined at build time, so this whole expression folds to a
 * constant and the dynamic import below is eliminated when it is false.
 *
 * The `NODE_ENV` half is not redundant. `next build` reads `.env.local` too,
 * so a developer with mocking enabled locally produces a production bundle
 * containing MSW — which is how this leaked the first time. Keying on the
 * build mode makes shipping the mock impossible rather than merely unlikely.
 */
const MOCKING_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

/**
 * Module-level so the worker is started exactly once per page load.
 *
 * Strict Mode invokes effects twice in development. Without this, the first
 * call succeeded but had its `setReady` cancelled by the cleanup, and the
 * second threw "cannot configure an already enabled network" — leaving the
 * gate closed forever and the whole app blank. Sharing one promise makes a
 * repeat call await the same startup instead of racing it.
 *
 * Only the promise lives out here. The `import()` itself must stay inside the
 * `MOCKING_ENABLED` branch below: moving it to module scope makes it reachable
 * in the module graph regardless of the flag, and MSW ships to production
 * again even though nothing calls it.
 */
let startPromise: Promise<unknown> | undefined;

/**
 * Holds rendering until the mock service worker is intercepting.
 *
 * The gate is not decoration: TanStack Query fires its first request from a
 * mount effect, and a request that starts before the worker is ready escapes
 * to the network. That produces a failure that appears and disappears between
 * runs, which is far more expensive to chase than a few hundred milliseconds
 * of blank screen in development.
 *
 * Both the server and the first client render return `null` when mocking is
 * on, so the trees match and hydration stays quiet.
 */
export function MockProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!MOCKING_ENABLED) return;

    let cancelled = false;

    startPromise ??= import('@/mocks/browser').then(({ worker }) =>
      worker.start({
        // Let anything unmocked through: Next.js fetches its own assets and
        // HMR endpoints, and failing those would break the dev server.
        onUnhandledRequest: 'bypass',
        serviceWorker: { url: '/mockServiceWorker.js' },
      }),
    );

    startPromise
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((error: unknown) => {
        // A gate that fails closed hides the app behind a blank page with no
        // explanation. Report it and render anyway; requests will hit the
        // network, which is at least a visible, diagnosable failure.
        console.error('[MockProvider] the mock worker failed to start', error);
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!MOCKING_ENABLED) return children;

  return ready ? children : null;
}
