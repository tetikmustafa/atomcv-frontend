import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';

/**
 * Bölüm 38.2 makes ICU MessageFormat mandatory, and this is why: English
 * distinguishes one from many, Turkish does not. String concatenation cannot
 * express that difference without the calling code knowing the grammar of
 * every language it will ever be translated into.
 *
 * These assertions read as trivial. They are the difference between "1 pages"
 * shipping and not.
 */
describe('ICU plural handling', () => {
  const enT = createTranslator({ locale: 'en', messages: en, namespace: 'Generation' });
  const trT = createTranslator({ locale: 'tr', messages: tr, namespace: 'Generation' });

  it('uses the singular form in English for one', () => {
    expect(enT('pageCount', { count: 1 })).toBe('1 page');
  });

  it('uses the plural form in English for more than one', () => {
    expect(enT('pageCount', { count: 3 })).toBe('3 pages');
  });

  it('keeps one Turkish form for both, because Turkish has no plural agreement here', () => {
    expect(trT('pageCount', { count: 1 })).toBe('1 sayfa');
    expect(trT('pageCount', { count: 3 })).toBe('3 sayfa');
  });
});

/**
 * English is the source catalogue (Bölüm XI-B.0), so a key present only in
 * Turkish is a mistake rather than a feature. Catching drift here is cheaper
 * than discovering a raw key on screen.
 */
describe('message catalogues', () => {
  function flatten(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    );
  }

  it('has the same keys in both languages', () => {
    expect(flatten(tr).sort()).toEqual(flatten(en).sort());
  });
});
