'use client';

/**
 * The content-language axis (§ 38.1), which is **not** the interface one.
 *
 * Three axes exist and only two of them live here: what language the profile
 * is written in (`sourceLanguage`), which languages it may be rendered in
 * (`enabledLanguages`), and — elsewhere entirely — which language the buttons
 * are in. The third is the locale in the URL and has nothing to do with these;
 * conflating them is the mistake `lib/i18n/locales.ts` exists to warn about,
 * and `routing.locales` is deliberately not read here.
 *
 * **The list is the server's** (`capabilities.allowedLanguages`), never
 * `routing.locales` and never a constant. Which languages a profile may offer
 * is a capability question — an anonymous session is English-only — so a
 * hardcoded list would be exactly the assumption § 9's anonymous rule
 * forbids.
 *
 * **This was a deliberate gap, and the reason it stayed one changed under
 * it.** The note said `allowedLanguages` was not published; it has been since
 * `B-081`, and was read against the running backend on 2026-09-08. What was
 * left was an unbuilt control rather than a missing answer — which is how a
 * deliberate gap turns into an unnoticed one, and why D13 closed it.
 *
 * **The source language cannot be switched off.** `enabledLanguages` must
 * contain it: a profile written in Turkish that may not be rendered in
 * Turkish is a profile with nothing to render, and the server refuses the
 * body rather than working out what was meant. So the source's own checkbox
 * is disabled and says why, instead of being absent — a control that
 * disappears when it becomes load-bearing teaches nothing.
 */

import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { useCapabilities } from '@/hooks/useSession';
import { languageName } from '@/lib/i18n/languageNames';

export type ContentLanguagesProps = {
  sourceLanguage: string;
  enabledLanguages: string[];
  onChange: (change: { sourceLanguage?: string; enabledLanguages?: string[] }) => void;
};

export function ContentLanguages({
  sourceLanguage,
  enabledLanguages,
  onChange,
}: ContentLanguagesProps) {
  const t = useTranslations('Editor.languages');
  const locale = useLocale();
  const capabilities = useCapabilities();
  const fieldId = useId();

  const allowed = capabilities?.allowedLanguages ?? [];

  /*
    One language is not a choice, and that is the anonymous session: it is
    English-only, so the whole control would be a fieldset around a fact.
    Drawn from the server's answer rather than from a session check, because
    the question is "how many may this profile offer" and the capability is
    the one thing that knows.
  */
  if (allowed.length < 2) return null;

  function toggle(code: string, on: boolean) {
    onChange({
      enabledLanguages: on
        ? [...enabledLanguages, code]
        : enabledLanguages.filter((candidate) => candidate !== code),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${fieldId}-source`}>{t('sourceLabel')}</Label>
        <p id={`${fieldId}-source-hint`} className="text-muted-foreground text-xs">
          {t('sourceHint')}
        </p>
        <select
          id={`${fieldId}-source`}
          value={sourceLanguage}
          aria-describedby={`${fieldId}-source-hint`}
          className="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-fit rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
          onChange={(event) => {
            const next = event.target.value;

            // The source is always enabled, so switching it brings its own
            // language with it. The server refuses a body where it is not,
            // and building an invalid one to be told so is a round trip that
            // teaches the reader nothing.
            onChange({
              sourceLanguage: next,
              enabledLanguages: enabledLanguages.includes(next)
                ? enabledLanguages
                : [...enabledLanguages, next],
            });
          }}
        >
          {allowed.map((code) => (
            <option key={code} value={code}>
              {languageName(code, locale) ?? code}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t('enabledLabel')}</legend>
        <p className="text-muted-foreground text-xs">{t('enabledHint')}</p>

        <div className="flex flex-wrap gap-4">
          {allowed.map((code) => {
            const isSource = code === sourceLanguage;

            return (
              <div key={code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  id={`${fieldId}-${code}`}
                  checked={isSource || enabledLanguages.includes(code)}
                  disabled={isSource}
                  {...(isSource ? { 'aria-describedby': `${fieldId}-${code}-why` } : {})}
                  onChange={(event) => toggle(code, event.target.checked)}
                />
                <span className="flex flex-col">
                  <label htmlFor={`${fieldId}-${code}`}>{languageName(code, locale) ?? code}</label>
                  {isSource && (
                    <span id={`${fieldId}-${code}-why`} className="text-muted-foreground text-xs">
                      {t('sourceAlwaysOn')}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
