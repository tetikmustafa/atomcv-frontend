/**
 * Language codes as language names, through `Intl` (rule 9).
 *
 * A BCP 47 tag is not a name, and the name belongs in the **reader's**
 * language rather than in its own — "Turkish" for an English interface,
 * "Türkçe" for a Turkish one. That is the interface axis (Bölüm 38.1), and it
 * is the right one here even when the code being named is a *content*
 * language: the person reading the screen is the user.
 *
 * Shared rather than written per component, because two call sites had begun
 * to need it and a second copy of an `Intl` rule is how the two drift.
 */

/**
 * The name of `code` in `locale`, or `code` itself when it cannot be named.
 *
 * `Intl.DisplayNames` throws on a malformed tag rather than returning
 * `undefined`, and the tags here come off the wire — a server that starts
 * sending something unexpected must not take the screen down with it. The
 * fallback is the raw code, which is worse than a name and far better than a
 * blank panel.
 *
 * An empty code returns `undefined` so the caller can say its own thing about
 * "no language" — that sentence is the caller's, not this function's.
 */
export function languageName(code: string | undefined, locale: string): string | undefined {
  if (!code) return undefined;

  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
