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
 *
 * Known trade: while this sits in the root layout, development also blanks
 * the landing page briefly. That disappears once providers move under the
 * `(app)` route group, where the marketing pages are not involved.
 */
export function MockProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!MOCKING_ENABLED) return;

    let cancelled = false;

    void (async () => {
      const { worker } = await import('@/mocks/browser');
      await worker.start({
        // Let anything unmocked through: Next.js fetches its own assets and
        // HMR endpoints, and failing those would break the dev server.
        onUnhandledRequest: 'bypass',
        serviceWorker: { url: '/mockServiceWorker.js' },
      });
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!MOCKING_ENABLED) return children;

  return ready ? children : null;
}
