'use client';

/**
 * What every generation starts from: how long, in which language, in which
 * register (§ 14.3).
 *
 * **Separate from `CvAppearance` because these are not appearance.** That
 * screen decides what the document looks like; this one decides what it says
 * and how much of it there is. Putting a page limit under "typeface and
 * margins" would file the product's central promise — the page limit is a
 * calculated constraint, not a hope — under a heading about looks.
 *
 * **Three of these were on the wire for two stages with nothing to set
 * them.** `maxPages` only ever reached a request when the server itself
 * offered `increase_page_limit` as a way out of an error, and the two
 * language fields were read by nobody: `GenerateScreen`'s own comment says
 * the page budget and the language "stay where the profile already decided
 * them", while the profile had no control that could decide either. This is
 * that control.
 *
 * **The output language is the third axis** (§ 38.1), and the one it is
 * easiest to confuse with the other two. Not the interface language, which is
 * the locale in the URL; not the profile's source language, which is
 * `ContentLanguages`. The options come from the profile's own
 * `enabledLanguages` — the languages it may be rendered in — because a
 * chooser built from `capabilities.allowedLanguages` would offer a language
 * this profile has no wordings for.
 *
 * **`auto` is a value, not an absence.** It means "follow the posting", which
 * is a third state next to "English" and "cleared" — and on a `PUT`, an
 * omitted field is the cleared one.
 *
 * **The writing style goes whole.** One screen owns all four of its fields,
 * so clearing the custom instructions is sending the object without them;
 * `useReplacePreferences` replaces that half rather than merging it, and this
 * is the screen that rule is written for.
 */

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useProfile, useReplacePreferences } from '@/hooks/useProfile';
import { languageName } from '@/lib/i18n/languageNames';
import { announce } from '@/stores/announcerStore';
import {
  CUSTOM_INSTRUCTIONS_MAX,
  LANGUAGE_FOLLOWS_POSTING,
  MAX_PAGES_RANGE,
  WRITING_TONES,
  type Preferences,
  type PreferencesUpdate,
  type WritingStyleUpdate,
} from '@/lib/api/endpoints/profile';

/** The unset register, which is the absence of `tone` rather than a value. */
const NO_TONE = '';

type ToneChoice = typeof NO_TONE | (typeof WRITING_TONES)[number];

const TONE_CHOICES: readonly ToneChoice[] = [NO_TONE, ...WRITING_TONES];

type Draft = {
  /** Text, not a number: an emptied box is a state the reader passes through. */
  maxPages: string;
  cvLanguage: string;
  coverLetterLanguage: string;
  tone: string;
  emphasizeMetrics: boolean;
  conciseSentences: boolean;
  customInstructions: string;
};

function draftFrom(preferences: Preferences | undefined): Draft {
  const defaults = preferences?.defaults;
  const style = preferences?.writingStyle;

  return {
    maxPages: defaults?.maxPages === undefined ? '' : String(defaults.maxPages),
    cvLanguage: defaults?.cvLanguage ?? LANGUAGE_FOLLOWS_POSTING,
    coverLetterLanguage: defaults?.coverLetterLanguage ?? LANGUAGE_FOLLOWS_POSTING,
    tone: style?.tone ?? NO_TONE,
    emphasizeMetrics: style?.emphasizeMetrics ?? false,
    conciseSentences: style?.conciseSentences ?? false,
    customInstructions: style?.customInstructions ?? '',
  };
}

export function GenerationDefaults() {
  const t = useTranslations('Settings.generationDefaults');
  const locale = useLocale();
  const fieldId = useId();

  const { data: profile } = useProfile();
  const save = useReplacePreferences();

  const preferences = profile?.data.preferences;
  const languages = profile?.data.enabledLanguages ?? [];

  /*
    The form's own copy, re-seeded whenever the server's answer changes — the
    same reasoning as `CvAppearance`, adjusted during render rather than in an
    effect so no frame shows values nobody has.
  */
  const [seed, setSeed] = useState(preferences);
  const [draft, setDraft] = useState(() => draftFrom(preferences));

  if (preferences !== seed) {
    setSeed(preferences);
    setDraft(draftFrom(preferences));
  }

  if (!profile) return null;

  /*
    One language is not a choice. An anonymous profile has exactly one, so
    this is the ordinary state rather than an edge case — and a select with a
    single option asks a question whose answer is already fixed.
  */
  const showLanguages = languages.length > 1;

  /*
    Named one by one rather than interpolated into `t('tones.' + tone)`.
    Message keys are typed, and a template literal defeats that — but the
    reason to keep it is the `Record`: if `WRITING_TONES` gains a value the
    server started sending, this stops compiling, which is where a closed
    vocabulary should fail.
  */
  const toneLabel: Record<(typeof WRITING_TONES)[number], string> = {
    formal: t('tones.formal'),
    casual: t('tones.casual'),
    technical: t('tones.technical'),
  };

  const pages = Number(draft.maxPages);
  const pagesValid =
    draft.maxPages === '' ||
    (Number.isInteger(pages) && pages >= MAX_PAGES_RANGE.min && pages <= MAX_PAGES_RANGE.max);
  const remaining = CUSTOM_INSTRUCTIONS_MAX - draft.customInstructions.length;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    const instructions = draft.customInstructions.trim();

    /*
      The whole writing style, with the unset fields left out rather than sent
      empty: an omitted `tone` is what "no register in particular" means, and
      an empty string would be a register called "".
    */
    const writingStyle: WritingStyleUpdate = {
      emphasizeMetrics: draft.emphasizeMetrics,
      conciseSentences: draft.conciseSentences,
      ...(draft.tone === NO_TONE ? {} : { tone: draft.tone as WritingStyleUpdate['tone'] }),
      ...(instructions === '' ? {} : { customInstructions: instructions }),
    };

    const body: PreferencesUpdate = {
      writingStyle,
      defaults: {
        // An emptied box means "no preference of mine", which the server
        // reads as its own default — so the key is dropped rather than sent
        // as a number this screen invented.
        ...(draft.maxPages === '' ? {} : { maxPages: pages }),
        ...(showLanguages
          ? { cvLanguage: draft.cvLanguage, coverLetterLanguage: draft.coverLetterLanguage }
          : {}),
      },
    };

    save.mutate(body, { onSuccess: () => announce(t('saved')) });
  }

  const languageOptions = [LANGUAGE_FOLLOWS_POSTING, ...languages];

  return (
    <section
      className="bg-card shadow-card flex flex-col gap-6 rounded-xl border p-5 sm:p-6"
      aria-labelledby={`${fieldId}-heading`}
    >
      <div>
        <h2 id={`${fieldId}-heading`} className="text-lg font-semibold">
          {t('title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('intro')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${fieldId}-pages`}>{t('maxPagesLabel')}</Label>
        <p id={`${fieldId}-pages-hint`} className="text-muted-foreground text-xs">
          {t('maxPagesHint')}
        </p>
        <Input
          id={`${fieldId}-pages`}
          type="number"
          inputMode="numeric"
          min={MAX_PAGES_RANGE.min}
          max={MAX_PAGES_RANGE.max}
          className="w-24"
          value={draft.maxPages}
          aria-describedby={`${fieldId}-pages-hint`}
          aria-invalid={!pagesValid}
          onChange={(event) => set('maxPages', event.target.value)}
        />
        {!pagesValid && (
          <p role="alert" className="text-destructive text-xs">
            {t('maxPagesRange', { min: MAX_PAGES_RANGE.min, max: MAX_PAGES_RANGE.max })}
          </p>
        )}
      </div>

      {showLanguages && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-cv-language`}>{t('cvLanguageLabel')}</Label>
            <p id={`${fieldId}-cv-language-hint`} className="text-muted-foreground text-xs">
              {t('cvLanguageHint')}
            </p>
            <NativeSelect
              id={`${fieldId}-cv-language`}
              value={draft.cvLanguage}
              aria-describedby={`${fieldId}-cv-language-hint`}
              onChange={(event) => set('cvLanguage', event.target.value)}
            >
              {languageOptions.map((code) => (
                <option key={code} value={code}>
                  {code === LANGUAGE_FOLLOWS_POSTING
                    ? t('followPosting')
                    : (languageName(code, locale) ?? code)}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-letter-language`}>{t('coverLetterLanguageLabel')}</Label>
            <NativeSelect
              id={`${fieldId}-letter-language`}
              value={draft.coverLetterLanguage}
              onChange={(event) => set('coverLetterLanguage', event.target.value)}
            >
              {languageOptions.map((code) => (
                <option key={code} value={code}>
                  {code === LANGUAGE_FOLLOWS_POSTING
                    ? t('followPosting')
                    : (languageName(code, locale) ?? code)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('toneLabel')}</legend>

        {/*
          The unset register is an option rather than the absence of one. A
          set of radios where nothing is selected looks like a form that has
          not loaded, and there is no way back to it once one is pressed.
        */}
        {TONE_CHOICES.map((tone) => (
          <div key={tone || 'unset'} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              id={`${fieldId}-tone-${tone || 'unset'}`}
              name={`${fieldId}-tone`}
              value={tone}
              checked={draft.tone === tone}
              onChange={() => set('tone', tone)}
            />
            <label htmlFor={`${fieldId}-tone-${tone || 'unset'}`}>
              {tone === NO_TONE ? t('toneUnset') : toneLabel[tone]}
            </label>
          </div>
        ))}
      </fieldset>

      <div className="flex items-center gap-3">
        <Switch
          id={`${fieldId}-metrics`}
          checked={draft.emphasizeMetrics}
          onCheckedChange={(next) => set('emphasizeMetrics', next)}
        />
        <Label htmlFor={`${fieldId}-metrics`} className="font-normal">
          {t('emphasizeMetrics')}
        </Label>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id={`${fieldId}-concise`}
          checked={draft.conciseSentences}
          onCheckedChange={(next) => set('conciseSentences', next)}
        />
        <Label htmlFor={`${fieldId}-concise`} className="font-normal">
          {t('conciseSentences')}
        </Label>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${fieldId}-instructions`}>{t('customInstructionsLabel')}</Label>
        <p id={`${fieldId}-instructions-hint`} className="text-muted-foreground text-xs">
          {t('customInstructionsHint')}
        </p>
        <Textarea
          id={`${fieldId}-instructions`}
          rows={3}
          maxLength={CUSTOM_INSTRUCTIONS_MAX}
          value={draft.customInstructions}
          aria-describedby={`${fieldId}-instructions-hint ${fieldId}-instructions-left`}
          onChange={(event) => set('customInstructions', event.target.value)}
        />
        {/*
          Rule 6, and polite: the count is context while typing, not an
          interruption. It appears only near the end — a counter that is
          always there reads as a limit being approached from the first
          keystroke.
        */}
        <p
          id={`${fieldId}-instructions-left`}
          role="status"
          aria-live="polite"
          className="text-muted-foreground text-xs"
        >
          {remaining <= 100 ? t('customInstructionsLeft', { remaining }) : ''}
        </p>
      </div>

      {save.error && <ErrorPanel error={save.error} />}

      <Button
        type="button"
        onClick={submit}
        disabled={save.isPending || !pagesValid}
        className="w-fit"
      >
        {save.isPending ? t('saving') : t('save')}
      </Button>
    </section>
  );
}
