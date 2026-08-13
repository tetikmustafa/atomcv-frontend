import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from './locales';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Every route carries its locale prefix, including the default one. The URL
  // is then always unambiguous, which matters because the UI language is only
  // one of three independent language axes (Bölüm 38.1).
  localePrefix: 'always',
});
