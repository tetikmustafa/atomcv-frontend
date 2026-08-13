import createMiddleware from 'next-intl/middleware';
import { routing } from '@/lib/i18n/routing';

/**
 * Redirects locale-less paths to a prefixed one (`/` -> `/en`).
 *
 * In Next.js 16 this file convention is `proxy.ts`; `middleware.ts` is
 * deprecated. The export may be default or named `proxy`.
 */
export default createMiddleware(routing);

export const config = {
  // Skip API calls, Next.js internals and anything with a file extension.
  //
  // Excluding `/api` is not an optimization: those requests are proxied to the
  // Spring backend, and rewriting them to `/en/api/v1/...` would break every
  // call the app makes.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
