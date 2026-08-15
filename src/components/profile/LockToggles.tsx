'use client';

/**
 * The three switches that change what selection is allowed to do with an atom
 * (Bölüm 37.1's 0ms gesture — a click is the whole decision).
 *
 * Each one gets a sentence under it, because the names are the model's, not
 * the user's: "verbatim" tells you nothing until you know that a rewrite is
 * something that happens to your wording by default.
 */

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export type LockToggle = 'active' | 'alwaysInclude' | 'verbatim';

export type LockTogglesProps = {
  values: Record<LockToggle, boolean>;
  onChange: (toggle: LockToggle, value: boolean) => void;
  disabled?: boolean;
};

const ORDER: LockToggle[] = ['active', 'alwaysInclude', 'verbatim'];

export function LockToggles({ values, onChange, disabled }: LockTogglesProps) {
  const t = useTranslations('Editor.atom');
  const baseId = useId();

  return (
    <ul className="flex flex-col gap-3">
      {ORDER.map((toggle) => {
        const id = `${baseId}-${toggle}`;
        const describedBy = `${id}-hint`;

        return (
          <li key={toggle} className="flex items-start gap-3">
            <Switch
              id={id}
              aria-describedby={describedBy}
              checked={values[toggle]}
              disabled={disabled ?? false}
              onCheckedChange={(next) => onChange(toggle, next)}
            />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={id}>{t(`${toggle}.label`)}</Label>
              <p id={describedBy} className="text-muted-foreground text-xs">
                {t(`${toggle}.hint`)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
