import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n/locales';
import { absoluteUrl, alternatesFor, PUBLIC_PATHS } from '@/lib/seo';

/**
 * `/sitemap.xml` — the three public pages, in both languages.
 *
 * **`alternates.languages` is the point of it**, more than the list of URLs.
 * Six entries that do not say which are translations of which read as six
 * pages competing with each other; with the map they read as three pages a
 * reader may have in either language.
 *
 * **No `lastModified`, and no `changeFrequency` or `priority`.** The first
 * would have to be a build timestamp, which would claim the privacy policy
 * changed every time anything was deployed — the one field here a crawler
 * actually acts on, spent on a lie. The other two are hints the major engines
 * documented themselves as ignoring, and an unread field that can go stale is
 * worse than an absent one.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: absoluteUrl(locale, path),
      alternates: { languages: alternatesFor(locale, path).languages },
    })),
  );
}
