/**
 * What the crawlers are told, in one place.
 *
 * Three facts live here because all three are easy to get subtly wrong and
 * impossible to notice afterwards: which origin the site is served from, which
 * paths are worth indexing, and which of them exist in more than one language.
 */

import { defaultLocale, locales } from '@/lib/i18n/locales';

/**
 * The origin, from the deployment rather than from the code.
 *
 * **It has no honest default**, which is why the fallback is localhost rather
 * than a domain: a sitemap listing a hostname nobody has registered is worse
 * than one a crawler cannot reach, because the second is obviously broken and
 * the first quietly points at somebody else's site. The deploy sets
 * `NEXT_PUBLIC_SITE_URL`; until there is a deploy there is no domain to set
 * (`deploy.yml` is not written yet, by decision).
 *
 * Trailing slashes are stripped so that joining is a concatenation and never
 * produces `//`.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

/**
 * The pages that are **for the public**, without their locale prefix.
 *
 * Everything else the product has is one person's own surface: a profile, a
 * generation, a history, a settings screen. None of it has anything to index
 * — a crawler reaching `/en/profile` sees an empty shell and an anonymous
 * session gets created for it — so the list is written as what is *in* rather
 * than what is out, and a route added later is private until someone says
 * otherwise.
 */
export const PUBLIC_PATHS = ['', '/legal/privacy', '/legal/terms'] as const;

/**
 * The first segment of every route that is somebody's own.
 *
 * Used to build `robots.txt`. Kept as segments rather than as full paths
 * because each one exists under every locale, and writing the cross-product by
 * hand is how one locale ends up crawlable.
 */
export const PRIVATE_SEGMENTS = [
  'onboarding',
  'profile',
  'generate',
  'generations',
  'history',
  'applications',
  'settings',
  'unsubscribe',
  'login',
  'verify',
  'auth',
  // The mock harness, which only exists outside production — listed anyway,
  // because a `Disallow` for a path that does not exist costs nothing and an
  // absent one for a path that does costs a crawled dev deployment.
  'dev',
] as const;

/** An absolute URL for a locale-prefixed path. `path` starts with `/` or is empty. */
export function absoluteUrl(locale: string, path = ''): string {
  return `${SITE_URL}/${locale}${path}`;
}

/**
 * `canonical` plus the `hreflang` map for one public page.
 *
 * **Every locale is prefixed, including the default one** (`localePrefix:
 * 'always'`), so there is no unprefixed URL to be canonical and the map has
 * no special case. `x-default` points at the default locale: it is what a
 * crawler shows somebody whose language matches neither, and leaving it out
 * makes that choice for them by accident.
 *
 * Both directions matter. Without `canonical`, `/en` and `/tr` look like
 * duplicate content; without `languages`, they look like unrelated pages and
 * each competes with the other.
 */
export function alternatesFor(locale: string, path = '') {
  return {
    canonical: absoluteUrl(locale, path),
    languages: {
      ...Object.fromEntries(locales.map((code) => [code, absoluteUrl(code, path)])),
      'x-default': absoluteUrl(defaultLocale, path),
    },
  };
}
