import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * Resolves the UI language and its message catalogue for the current request.
 *
 * `requestLocale` is marked deprecated in favour of `next/root-params`, which
 * landed in Next.js 16.3. We stay on it for now: it is typed, it covers the
 * cases root params cannot (an explicit locale passed to `getTranslations`,
 * and requests that fall outside the `[locale]` segment), and root params are
 * unavailable in Route Handlers. Revisit once that gap closes.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
