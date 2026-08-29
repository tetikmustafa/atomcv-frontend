import type { Formats } from 'next-intl';

/**
 * The named formats `useFormatter` resolves (rule 9: never hand-format a date).
 *
 * next-intl ships **no** defaults for these. Asking for one it does not know
 * is not a type error and does not throw the render — it logs `MISSING_FORMAT`
 * and prints a fallback — so a screen can ship with a date nobody configured
 * and only a server log says so. That is exactly what had happened to the
 * feedback panel's grant expiry before the history screen hit the same wall.
 *
 * Declared here rather than inline in `request.ts` so the test wrappers, which
 * build their own provider, can use the same object: a date formatted one way
 * in tests and another in the browser is a difference nothing would catch.
 */
export const formats = {
  dateTime: {
    /**
     * Date **and** time, deliberately. Both readers of this format are
     * distinguishing things that happen on the same day: two resumes built one
     * afternoon, and a 48-hour grant that expires at an hour rather than on a
     * date (§ 48.4).
     */
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    },
  },
} satisfies Formats;
