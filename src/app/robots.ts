import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n/locales';
import { PRIVATE_SEGMENTS, SITE_URL } from '@/lib/seo';

/**
 * `/robots.txt`.
 *
 * **Written as a deny list over one allow.** The marketing surface is three
 * pages and the product is everything else, so the rule that matters is the
 * second: a crawler reaching `/en/profile` gets an empty shell, an anonymous
 * session created for it, and a row in somebody's rate limit — none of which
 * is content, and the two-hour session it starts is a cost with no reader.
 *
 * The cross-product is generated rather than typed out. Writing
 * `/en/profile` and `/tr/profile` by hand is how a locale added later stays
 * crawlable while everything looks right.
 *
 * `/api/` is disallowed although nginx serves it and Next never sees it: the
 * file is read by whoever is crawling the **origin**, not the framework.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = [
    ...locales.flatMap((locale) => PRIVATE_SEGMENTS.map((segment) => `/${locale}/${segment}`)),
    '/api/',
  ];

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
