'use client';

/**
 * A second wording for an atom, in another language (§ 38.1, `B-081`).
 *
 * **The wording is typed before the variant exists.** Seeding a new one with
 * the text of an existing wording would be quicker and would be the bug the
 * whole stale-wording subsystem is about: a Turkish variant holding English
 * text renders an English sentence in a Turkish CV, and nothing would say so
 * — the server marks a wording stale when the atom changes under it, not when
 * it was never written in the first place.
 *
 * **Gated on `canAddAlternatives`** (§ 35.7.2), and hidden rather than
 * disabled, like the atom controls beside it: a locked control repeated by
 * every one of two hundred atoms is an upsell in the middle of somebody's own
 * work, and § 9's promise is a narrower product rather than a nagging one.
 *
 * **The languages offered are the profile's**, minus the ones this atom
 * already has. That is the content-language axis — `enabledLanguages` on the
 * head — and not the interface language a reader happens to be using. With
 * nothing left to add, the control is not drawn at all: an empty select is a
 * question with no answers.
 */

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useAddVariant } from '@/hooks/useProfile';
import { useCapabilities } from '@/hooks/useSession';
import { languageName } from '@/lib/i18n/languageNames';
import type { Variant } from '@/lib/api/endpoints/profile';
import { announce } from '@/stores/announcerStore';

type Tone = NonNullable<Variant['tone']>;

/** The neutral register and the schema's three named ones. */
const REGISTERS = ['', 'formal', 'casual', 'technical'] as const satisfies readonly (Tone | '')[];

export type AddWordingProps = {
  atomId: string;
  /** The wordings this atom already has, so their languages are not offered. */
  variants: Variant[];
  /** The profile's content languages (`enabledLanguages`), in its own order. */
  languages: string[];
  /** Selects the new wording, so the reader lands in what they just wrote. */
  onAdded: (variantId: string) => void;
};

export function AddWording({ atomId, variants, languages, onAdded }: AddWordingProps) {
  const t = useTranslations('Editor.variants');
  const locale = useLocale();
  const capabilities = useCapabilities();
  const add = useAddVariant();

  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone | ''>('');
  const [text, setText] = useState('');

  /**
   * Which registers each language still has room for. The server refuses a
   * second wording with the same language **and** tone, so the pair is the
   * unit, and a language is offered while any of its four slots is free.
   * Neutral (`''`) first: it is the wording a resume falls back to. This used
   * to offer the neutral register only — the tone had no control anywhere.
   */
  const freeTones = (code: string) =>
    REGISTERS.filter(
      (register) =>
        !variants.some((variant) => variant.language === code && (variant.tone ?? '') === register),
    );
  // A language with no neutral wording first: a missing language is the gap a
  // resume in it would fall into, a missing register only a refinement.
  const missing = languages
    .filter((code) => freeTones(code).length > 0)
    .sort((a, b) => Number(!freeTones(a).includes('')) - Number(!freeTones(b).includes('')));

  if (!capabilities?.canAddAlternatives || missing.length === 0) return null;

  const chosen = language && missing.includes(language) ? language : missing[0]!;
  const tones = freeTones(chosen);
  const chosenTone = tones.includes(tone) ? tone : tones[0]!;
  const nameOf = (code: string) => languageName(code, locale) ?? code;

  function submit() {
    const wording = text.trim();
    if (wording === '') return;

    add.mutate(
      {
        atomId,
        // Runs, because that is what content is — one unmarked run here. The
        // editor drops marks on a text edit too, and says so; this is the
        // same limit at the moment a wording is created.
        body: {
          content: { runs: [{ t: wording, m: [] }] },
          language: chosen,
          // Left out for the neutral register, which is how the schema says it.
          ...(chosenTone ? { tone: chosenTone } : {}),
        },
      },
      {
        onSuccess: (variant) => {
          setText('');
          setOpen(false);
          announce(t('added', { language: nameOf(chosen) }));
          if (variant.id) onAdded(variant.id);
        },
      },
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        {t('add')}
      </Button>
    );
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${atomId}-wording-language`}>{t('addLanguage')}</Label>

          {/*
            A select even for one option. The alternative is a button that
            names the language, which reads as "add Turkish" until a third
            language is enabled and then silently becomes a different control.
          */}
          <NativeSelect
            id={`${atomId}-wording-language`}
            value={chosen}
            onChange={(event) => setLanguage(event.target.value)}
            className="sm:w-full"
          >
            {missing.map((code) => (
              <option key={code} value={code}>
                {nameOf(code)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${atomId}-wording-tone`}>{t('addTone')}</Label>
          <NativeSelect
            id={`${atomId}-wording-tone`}
            value={chosenTone}
            aria-describedby={`${atomId}-wording-tone-hint`}
            onChange={(event) => setTone(event.target.value as Tone | '')}
            className="sm:w-full"
          >
            {tones.map((register) => (
              <option key={register || 'neutral'} value={register}>
                {t('tone', { tone: register || 'neutral' })}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <p id={`${atomId}-wording-tone-hint`} className="text-muted-foreground -mt-1 text-xs">
        {t('toneHint')}
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${atomId}-wording-text`}>{t('addText')}</Label>
        <Textarea
          id={`${atomId}-wording-text`}
          rows={2}
          value={text}
          aria-describedby={`${atomId}-wording-hint`}
          onChange={(event) => setText(event.target.value)}
        />
        <p id={`${atomId}-wording-hint`} className="text-muted-foreground text-xs">
          {t('addHint')}
        </p>
      </div>

      {add.error && <ErrorPanel error={add.error} />}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="w-fit"
          disabled={add.isPending || text.trim() === ''}
          onClick={submit}
        >
          {add.isPending ? t('adding') : t('addSubmit')}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setText('');
            add.reset();
          }}
        >
          {t('addCancel')}
        </Button>
      </div>
    </div>
  );
}
