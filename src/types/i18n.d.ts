import type { Locale } from '@/lib/i18n/locales';
import type messages from '../messages/en.json';

/**
 * Makes message keys checked at compile time and narrows next-intl's `Locale`
 * to ours. English is the source catalogue (Bölüm XI-B.0), so a key that only
 * exists in tr.json is a mistake, not a feature.
 */
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
