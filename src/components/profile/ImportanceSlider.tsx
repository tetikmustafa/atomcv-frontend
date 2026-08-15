'use client';

/**
 * Importance, 0 to 1 (Bölüm 37.1's 500ms gesture).
 *
 * Radix carries the keyboard behaviour — arrows, Home, End — so rule 5 is met
 * by the primitive rather than by a second set of buttons bolted on. What it
 * cannot supply is the *meaning* of the number: a slider that announces "0.6"
 * says nothing, so `aria-valuetext` carries a formatted value and the label is
 * wired by id, because the thumb is not an input and `htmlFor` does not reach
 * it.
 */

import { useId } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export type ImportanceSliderProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function ImportanceSlider({ value, onChange, disabled }: ImportanceSliderProps) {
  const t = useTranslations('Editor.atom');
  const format = useFormatter();
  const labelId = useId();

  // Rule 9: even a bare number goes through Intl, or the decimal separator is
  // wrong for half the audience the moment the locale is not English.
  const spoken = format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label id={labelId}>{t('importance')}</Label>
        <span className="text-muted-foreground text-sm tabular-nums">{spoken}</span>
      </div>

      <Slider
        aria-labelledby={labelId}
        aria-valuetext={spoken}
        value={[value]}
        min={0}
        max={1}
        step={0.05}
        disabled={disabled ?? false}
        onValueChange={([next]) => onChange(next ?? 0)}
      />
    </div>
  );
}
