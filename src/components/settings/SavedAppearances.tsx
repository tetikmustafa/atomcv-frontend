'use client';

/**
 * Appearance settings kept under a name (`F-038`, § 13.2).
 *
 * **The working set is still the working set.** `preferences.appearance`
 * above is what every generation uses when it names nothing, and that is
 * nearly every generation. This is the second thing: somebody who keeps a
 * dense set for a long CV and a roomier one for a short one, and picks
 * between them per generation with `customizationId`.
 *
 * **Saving copies what is already on screen**, rather than opening a second
 * set of sliders. Two places to set the same five values would be two places
 * to get them wrong, and the reader has just arranged the ones above — the
 * question this screen asks is what to call them, not what they should be.
 *
 * **Deleting warns about nothing, and that is correct.** A generation made
 * with a set holds the settings themselves in its snapshot rather than an id,
 * so every resume already sent still re-renders exactly as it was. There is
 * no cascade to describe and no old document at risk.
 *
 * **Behind `canCustomizeTemplate`**, like the sliders it saves: an anonymous
 * caller has no Layer B to keep, so the control would be a name for nothing.
 */

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { DeleteControl } from '@/components/profile/DeleteControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateCustomization,
  useCustomizations,
  useDeleteCustomization,
} from '@/hooks/useAppearance';
import { useCapabilities } from '@/hooks/useSession';
import type { Preferences } from '@/lib/api/endpoints/profile';
import { announce } from '@/stores/announcerStore';

/** Twenty per profile, which the endpoint states and the form respects. */
export const CUSTOMIZATION_LIMIT = 20;

export type SavedAppearancesProps = {
  /** The working set, which is what saving copies. */
  defaults: Preferences['defaults'];
};

export function SavedAppearances({ defaults }: SavedAppearancesProps) {
  const t = useTranslations('Appearance.presets');
  const capabilities = useCapabilities();

  const canKeep = capabilities?.canCustomizeTemplate === true;
  const kept = useCustomizations(canKeep);
  const create = useCreateCustomization();
  const remove = useDeleteCustomization();

  const nameId = useId();
  const [name, setName] = useState('');

  if (!canKeep) return null;

  const rows = kept.data ?? [];
  const full = rows.length >= CUSTOMIZATION_LIMIT;

  function keep() {
    const trimmed = name.trim();
    if (trimmed === '' || full) return;

    create.mutate(
      {
        name: trimmed,
        // The working set, copied. `baseTemplateId` is required, and the
        // fallback is the same one the preferences form treats as the
        // starting template rather than a choice of ours.
        baseTemplateId: defaults?.templateId ?? 'classic',
        ...(defaults?.appearance ?? {}),
      },
      {
        onSuccess: (row) => {
          announce(t('announceKept', { name: row.name ?? trimmed }));
          setName('');
        },
      },
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">{t('title')}</h3>
      <p className="text-muted-foreground text-sm">{t('intro')}</p>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex flex-col">
                <span>{row.name}</span>
                <span className="text-muted-foreground text-xs">
                  {t('builtOn', { template: row.baseTemplateId ?? '' })}
                </span>
              </span>

              <DeleteControl
                triggerLabel={t('remove', { name: row.name ?? '' })}
                title={t('removeTitle')}
                // No cascade to describe: the resumes made with it are
                // unaffected, because each holds the settings rather than a
                // reference to this row.
                description={t('removeBody')}
                confirmLabel={t('removeConfirm')}
                onConfirm={() => remove.mutateAsync(row.id!)}
                isPending={remove.isPending}
                error={remove.error}
                onReset={remove.reset}
              />
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t('full', { max: CUSTOMIZATION_LIMIT })}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={nameId}>{t('nameLabel')}</Label>
            <Input
              id={nameId}
              value={name}
              disabled={create.isPending}
              placeholder={t('namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={name.trim() === '' || create.isPending}
            onClick={keep}
          >
            {create.isPending ? t('keeping') : t('keep')}
          </Button>
        </div>
      )}

      {create.error && <ErrorPanel error={create.error} onDismiss={create.reset} />}
      {kept.error && <ErrorPanel error={kept.error} onRetry={() => void kept.refetch()} />}
    </section>
  );
}
