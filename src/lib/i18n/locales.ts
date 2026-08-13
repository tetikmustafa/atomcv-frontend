/**
 * The UI language axis (Bölüm 38.1). Independent from the profile source
 * language and from the generated CV's content language — never reuse this
 * list to format anything that belongs to a CV.
 *
 * English is the source language; Turkish is a translation (Bölüm XI-B.0).
 */
export const locales = ['en', 'tr'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
