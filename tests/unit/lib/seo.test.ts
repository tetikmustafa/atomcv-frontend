import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { alternatesFor, PRIVATE_SEGMENTS, PUBLIC_PATHS, SITE_URL } from '@/lib/seo';
import { locales } from '@/lib/i18n/locales';

/** `rules` is one rule or a list of them; this file writes a list. */
function disallowed(): string[] {
  const { rules } = robots();
  const list = Array.isArray(rules) ? rules : [rules];

  return list.flatMap((rule) => {
    const paths = rule.disallow ?? [];
    return Array.isArray(paths) ? paths : [paths];
  });
}

/**
 * What the crawlers are told.
 *
 * None of this is visible in the product, which is exactly why it is worth
 * pinning: a `robots.txt` that stops disallowing a route, or an `hreflang`
 * map that loses a language, changes nothing anyone would notice until a
 * search result is wrong months later.
 */
describe('robots.txt', () => {
  it('keeps every private route out, in every language', () => {
    const disallow = disallowed();

    // The cross-product, not a sample of it: writing `/en/profile` by hand is
    // how a locale added later stays crawlable while everything looks right.
    for (const locale of locales) {
      for (const segment of PRIVATE_SEGMENTS) {
        expect(disallow).toContain(`/${locale}/${segment}`);
      }
    }
  });

  /**
   * The landing page is the thinnest point of the anonymous funnel and the
   * only page a stranger arrives at. A deny list that swallowed it would be
   * invisible here and fatal outside.
   */
  it('leaves the marketing surface crawlable', () => {
    const disallow = disallowed();

    for (const locale of locales) {
      expect(disallow).not.toContain(`/${locale}`);
      expect(disallow).not.toContain(`/${locale}/legal/privacy`);
    }
  });

  it('points at the sitemap on the same origin', () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe('the sitemap', () => {
  it('lists every public page in every language, and nothing else', () => {
    const entries = sitemap();

    expect(entries).toHaveLength(locales.length * PUBLIC_PATHS.length);
    expect(entries.map((entry) => entry.url)).toContain(`${SITE_URL}/tr/legal/terms`);
    // No private route slipped in through a path list that grew.
    expect(entries.some((entry) => entry.url.includes('/profile'))).toBe(false);
  });

  /**
   * The half that does the work: six entries that do not say which are
   * translations of which read as six pages competing with each other.
   */
  it('says which entries are translations of which', () => {
    const entry = sitemap().find((candidate) => candidate.url === `${SITE_URL}/en`)!;

    expect(entry.alternates?.languages).toEqual({
      en: `${SITE_URL}/en`,
      tr: `${SITE_URL}/tr`,
      'x-default': `${SITE_URL}/en`,
    });
  });

  /**
   * A build timestamp would claim the privacy policy changed on every deploy
   * — the one field here a crawler acts on, spent on something untrue.
   */
  it('claims no modification date it cannot know', () => {
    expect(sitemap().every((entry) => entry.lastModified === undefined)).toBe(true);
  });
});

describe('the hreflang map', () => {
  /**
   * `localePrefix: 'always'` means there is no unprefixed URL, so the default
   * locale is not a special case — and `x-default` has to be stated, or the
   * choice for a reader whose language matches neither is made by accident.
   */
  it('carries every locale plus an explicit default', () => {
    const { canonical, languages } = alternatesFor('tr', '/legal/privacy');

    expect(canonical).toBe(`${SITE_URL}/tr/legal/privacy`);
    expect(Object.keys(languages).sort()).toEqual([...locales, 'x-default'].sort());
    expect(languages['x-default']).toBe(`${SITE_URL}/en/legal/privacy`);
  });

  it('makes each locale canonical for itself, never for the other', () => {
    expect(alternatesFor('en').canonical).not.toBe(alternatesFor('tr').canonical);
  });
});
