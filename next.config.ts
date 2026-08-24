import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const apiProxyTarget = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  /**
   * Emits a self-contained server bundle with only the dependencies actually
   * reached, so the runtime image does not carry node_modules.
   */
  output: 'standalone',

  /**
   * Off in development, and this is not a performance decision.
   *
   * The dev server gzips what the rewrite below proxies, and gzip buffers:
   * measured against the running backend, the four progress frames of one
   * generation arrived 1 ms, 256 ms, 272 ms and 905 ms apart when read
   * straight from Spring, and **all together at 867 ms** through the rewrite.
   * A progress bar that only moves once, at the end, is not a progress bar —
   * and every local check against the real backend would say the client is
   * broken (§ 30.6, the same hazard nginx's `proxy_buffering off` covers).
   *
   * Production is untouched: the rewrite does not exist there, nginx serves
   * both origins and compresses, and Next is not in the path of a stream.
   */
  compress: process.env.NODE_ENV === 'production',

  /**
   * Development-only proxy to the Spring backend.
   *
   * In production nginx serves both under one origin, so `/api/*` reaches
   * Spring without Next.js involved. Locally the frontend is on :3000 and the
   * backend on :8080. Calling :8080 directly would make every request
   * cross-origin, which breaks the `SameSite=Strict` session cookie and drags
   * in CORS — so dev would stop resembling production exactly where auth
   * bugs hide.
   *
   * This is a rewrite, not a route handler: no code of ours runs, so it does
   * not violate the "no business logic in src/app/api" rule.
   */
  async rewrites() {
    if (process.env.NODE_ENV === 'production' || !apiProxyTarget) return [];

    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
