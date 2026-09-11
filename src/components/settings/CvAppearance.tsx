'use client';

/**
 * What the CV looks like: which template, and the five things about it a
 * person may change (§ 33, `B-090`, `B-091`, `B-092`).
 *
 * **The choice lives in the profile's preferences, not in the request.**
 * There is no "this template for this generation" — `POST /generations` takes
 * no template field — so this is where it is decided, and every resume made
 * afterwards comes out that way.
 *
 * **Gated on `capabilities`, never on assumptions.** The template list is the
 * server's and is ordered; Layer B — the geometry and the colour — is behind
 * `canCustomizeTemplate`. An anonymous caller gets the preset templates and
 * no sliders, which is § 9's narrower product rather than a lesser one.
 *
 * **An omitted field means the template's own setting**, which is the state
 * "reset" returns a control to. So nothing here shows a default value for an
 * untouched control: `modern` starts on a blue accent and the other two on
 * black (`B-092`), and a form that printed a colour of its own would be
 * asserting something about a template it has never seen.
 *
 * **The four geometric fields cost a measurement and the colour does not**
 * (§ 33.1). Nothing on screen says so, deliberately: the measurement happens
 * in the background, nobody waits for it, and the only visible consequence is
 * that the first resume in a brand-new geometry may run a few lines short.
 * § 33.3's "recalculating…" indicator would need an endpoint publishing that
 * state and there is none.
 */

import { useId, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useProfile, useReplacePreferences } from '@/hooks/useProfile';
import { useCapabilities } from '@/hooks/useSession';
import {
  ACCENT_COLOR_PATTERN,
  APPEARANCE_RANGES,
  ATS_READABLE_FONT_SIZE_PT,
  FONT_FAMILIES,
  type AppearanceUpdate,
  type Preferences,
  type PreferencesUpdate,
} from '@/lib/api/endpoints/profile';
import { announce } from '@/stores/announcerStore';

type GeometryField = 'fontSizePt' | 'marginInches' | 'lineSpacing';

/**
 * Same reason as in `useErrorMessage`: the key is **data**, not a literal.
 *
 * The template list is the server's, so an id this build has no word for is a
 * possibility rather than a bug — and `t.has` is how it falls back to the id
 * itself. A typed key cannot express that; an inline `as never` per call
 * would also collapse the values argument and quietly stop passing params.
 */
type LooseTranslator = ((key: string) => string) & { has(key: string): boolean };

/**
 * What the reader has changed and not yet sent.
 *
 * `colorText` is kept beside the appearance rather than inside it because a
 * half-typed hex is not a colour: the field is optional on the wire, so
 * "not yet six digits" and "no colour" are the same state there, and only the
 * form needs to tell them apart.
 */
type Draft = {
  templateId?: string;
  appearance: AppearanceUpdate;
  colorText: string;
};

function draftFrom(defaults: Preferences['defaults']): Draft {
  // `empty` is springdoc publishing the record's `isEmpty()`; the write
  // schema does not declare it, so it must not travel back.
  const stored: Record<string, unknown> = { ...(defaults?.appearance ?? {}) };
  delete stored.empty;
  const appearance = stored as AppearanceUpdate;

  return {
    ...(defaults?.templateId ? { templateId: defaults.templateId } : {}),
    appearance,
    colorText: appearance.accentColor ?? '',
  };
}

export function CvAppearance() {
  const t = useTranslations('Appearance');
  const loose = t as unknown as LooseTranslator;
  const format = useFormatter();
  const capabilities = useCapabilities();
  const { data: profile } = useProfile();
  const save = useReplacePreferences();

  const templates = capabilities?.allowedTemplates ?? [];
  const canCustomize = capabilities?.canCustomizeTemplate ?? false;

  const preferences = profile?.data.preferences;
  const defaults = preferences?.defaults;

  /*
    The form's own copy, re-seeded whenever the server's answer changes.
    Server data is not copied into a store (rule 3); this is a **draft of a
    write**, which is a different thing — the cache still holds what the
    server said, and this holds what the reader has not sent yet.

    Adjusted during render rather than in an effect. An effect would render
    the stale draft once, then render again with the seeded one, and the
    intermediate frame is a form showing values nobody has: React's own
    answer to "state that follows a prop" is to compare and set while
    rendering, which it restarts before touching the DOM.
  */
  const [seed, setSeed] = useState(defaults);
  const [draft, setDraft] = useState(() => draftFrom(defaults));

  if (defaults !== seed) {
    setSeed(defaults);
    setDraft(draftFrom(defaults));
  }

  const { templateId, appearance, colorText } = draft;

  if (capabilities === undefined || !profile) return null;

  // One template is not a choice. The list is the server's and stays ordered,
  // so this draws what it was given rather than a catalogue of its own.
  const showTemplates = templates.length > 1;
  if (!showTemplates && !canCustomize) return null;

  function setTemplateId(next: string) {
    setDraft((current) => ({ ...current, templateId: next }));
  }

  function setColorText(next: string) {
    setDraft((current) => ({ ...current, colorText: next }));
  }

  function set(field: GeometryField, value: number) {
    setDraft((current) => ({
      ...current,
      appearance: { ...current.appearance, [field]: value },
    }));
  }

  function setFontFamily(family: (typeof FONT_FAMILIES)[number]) {
    setDraft((current) => ({
      ...current,
      appearance: { ...current.appearance, fontFamily: family },
    }));
  }

  /** Back to the template's own setting, which is an **omission** not a value. */
  function clear(field: keyof AppearanceUpdate) {
    setDraft((current) => {
      const next = { ...current.appearance };
      delete next[field];

      return {
        ...current,
        appearance: next,
        ...(field === 'accentColor' ? { colorText: '' } : {}),
      };
    });
  }

  function submit() {
    const colour = colorText.trim();
    const valid = colour !== '' && ACCENT_COLOR_PATTERN.test(colour);

    const nextAppearance: AppearanceUpdate = {
      ...appearance,
      ...(valid ? { accentColor: colour } : {}),
    };
    if (!valid) delete nextAppearance.accentColor;

    /*
      The **whole** preferences object, not the part that changed: `PUT`
      replaces, and a body carrying only `defaults` would clear the writing
      style — which is the very omission the endpoint was split off the head
      to prevent.
    */
    const body: PreferencesUpdate = {
      ...(preferences?.writingStyle ? { writingStyle: preferences.writingStyle } : {}),
      defaults: {
        ...defaults,
        ...(templateId ? { templateId } : {}),
        appearance: nextAppearance,
      },
    };

    save.mutate(body, { onSuccess: () => announce(t('saved')) });
  }

  const fontSize = appearance.fontSizePt;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="cv-appearance">
      <div className="flex flex-col gap-1">
        <h2 id="cv-appearance" className="text-lg font-medium">
          {t('title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('intro')}</p>
      </div>

      {showTemplates && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t('template')}</legend>

          <div className="flex flex-wrap gap-4">
            {templates.map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="templateId"
                  value={id}
                  checked={templateId === id}
                  onChange={() => setTemplateId(id)}
                />
                {/* A name the server has never sent us: the list is ids, and
                    an id this build has no word for still has to be pickable
                    rather than hidden. */}
                {loose.has(`templates.${id}`) ? loose(`templates.${id}`) : id}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {canCustomize && (
        <div className="flex flex-col gap-6">
          <GeometryControl
            field="fontSizePt"
            label={t('fontSize')}
            value={fontSize}
            spoken={(value) => t('fontSizeValue', { value })}
            unset={t('templateDefault')}
            reset={t('reset')}
            format={format}
            onChange={set}
            onClear={clear}
          />

          {/*
            § 33.2 by name: 9pt is legal and stays available, and the reader
            is told what it costs rather than stopped. A note under the
            control, not an error — nothing is wrong and there is nothing to
            acknowledge.
          */}
          {fontSize !== undefined && fontSize < ATS_READABLE_FONT_SIZE_PT && (
            <p data-testid="font-size-warning" className="text-muted-foreground -mt-4 text-sm">
              {t('fontSizeWarning', { recommended: ATS_READABLE_FONT_SIZE_PT })}
            </p>
          )}

          <GeometryControl
            field="marginInches"
            label={t('margin')}
            value={appearance.marginInches}
            spoken={(value) => t('marginValue', { value })}
            unset={t('templateDefault')}
            reset={t('reset')}
            format={format}
            onChange={set}
            onClear={clear}
          />

          <GeometryControl
            field="lineSpacing"
            label={t('lineSpacing')}
            value={appearance.lineSpacing}
            spoken={(value) => t('lineSpacingValue', { value })}
            unset={t('templateDefault')}
            reset={t('reset')}
            format={format}
            onChange={set}
            onClear={clear}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t('fontFamily')}</legend>

            <div className="flex flex-wrap gap-4">
              {FONT_FAMILIES.map((family) => (
                <label key={family} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="fontFamily"
                    value={family}
                    checked={appearance.fontFamily === family}
                    onChange={() => setFontFamily(family)}
                  />
                  {t(`fontFamilies.${family}`)}
                </label>
              ))}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="fontFamily"
                  value=""
                  checked={appearance.fontFamily === undefined}
                  onChange={() => clear('fontFamily')}
                />
                {t('templateDefault')}
              </label>
            </div>
          </fieldset>

          <AccentColor
            value={colorText}
            onChange={setColorText}
            onClear={() => clear('accentColor')}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={submit} disabled={save.isPending} className="w-fit">
          {save.isPending ? t('saving') : t('save')}
        </Button>

        {/*
          Rule 6: the outcome is announced rather than left to a colour or an
          icon. `role="status"` is polite — a save that worked is not an
          interruption.
        */}
        <p role="status" className="text-muted-foreground text-sm">
          {save.isSuccess ? t('saved') : save.isError ? t('saveFailed') : ''}
        </p>
      </div>
    </section>
  );
}

/**
 * One of the three measured numbers.
 *
 * The label is wired by id rather than `htmlFor`: Radix puts `role="slider"`
 * on the thumb, which is not an input, so a label pointing at the root would
 * name a plain `div`. `aria-valuetext` carries the formatted value, because
 * "0.65" announced on its own says nothing about inches.
 */
function GeometryControl({
  field,
  label,
  value,
  spoken,
  unset,
  reset,
  format,
  onChange,
  onClear,
}: {
  field: GeometryField;
  label: string;
  value: number | undefined;
  spoken: (value: string) => string;
  unset: string;
  reset: string;
  format: ReturnType<typeof useFormatter>;
  onChange: (field: GeometryField, value: number) => void;
  onClear: (field: GeometryField) => void;
}) {
  const labelId = useId();
  const range = APPEARANCE_RANGES[field];

  // Rule 9: even a bare number goes through `Intl`, or the decimal separator
  // is wrong for half the audience the moment the locale is not English.
  const printed =
    value === undefined ? undefined : format.number(value, { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label id={labelId}>{label}</Label>
        <span className="text-muted-foreground text-sm tabular-nums">
          {printed === undefined ? unset : spoken(printed)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Slider
          aria-labelledby={labelId}
          aria-valuetext={printed === undefined ? unset : spoken(printed)}
          // A slider has to sit somewhere, and where it sits while the
          // template decides is the middle of the range — which is why the
          // number beside it says "the template's" rather than printing this
          // value as though it had been chosen.
          value={[value ?? (range.min + range.max) / 2]}
          min={range.min}
          max={range.max}
          step={range.step}
          onValueChange={([next]) => onChange(field, next ?? range.min)}
        />

        {value !== undefined && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onClear(field)}>
            {reset}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The one free change (§ 33.1): a colour invalidates no measurement.
 *
 * Six hex digits without a `#`, which is what the server stores. A malformed
 * value is not sent at all rather than refused server-side — the field is
 * optional, so "not yet a colour" and "no colour" are the same state on the
 * wire.
 */
function AccentColor({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations('Appearance');
  const id = useId();
  const valid = ACCENT_COLOR_PATTERN.test(value);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t('accentColor')}</Label>

      <div className="flex items-center gap-3">
        <Input
          id={id}
          value={value}
          maxLength={6}
          placeholder="1D4ED8"
          aria-describedby={`${id}-hint`}
          aria-invalid={value !== '' && !valid}
          onChange={(event) => onChange(event.target.value)}
          className="w-32 font-mono"
        />

        {/* Decorative: the hex beside it is the value, and a swatch that
            announced itself would say the same thing twice. */}
        <span
          aria-hidden="true"
          data-testid="accent-swatch"
          className="border-border size-6 rounded-md border"
          style={valid ? { backgroundColor: `#${value}` } : undefined}
        />

        {value !== '' && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            {t('reset')}
          </Button>
        )}
      </div>

      <p id={`${id}-hint`} className="text-muted-foreground text-sm">
        {t('accentColorHint')}
      </p>
    </div>
  );
}
