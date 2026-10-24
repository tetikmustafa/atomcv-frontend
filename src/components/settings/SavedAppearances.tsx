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
import { useFormatter, useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { DeleteControl } from '@/components/profile/DeleteControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateCustomization,
  useCustomizations,
  useDeleteCustomization,
  usePatchCustomization,
} from '@/hooks/useAppearance';
import { useCapabilities } from '@/hooks/useSession';
import type { Customization, Preferences } from '@/lib/api/endpoints/profile';
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
    <section className="flex flex-col gap-3 border-t pt-6">
      <h3 className="text-base font-semibold">{t('title')}</h3>
      <p className="text-muted-foreground text-sm">{t('intro')}</p>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <SavedRow
              key={row.id}
              row={row}
              defaults={defaults}
              remove={
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
              }
            />
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

/**
 * One saved set: what it holds, and the two changes `PATCH
 * /customizations/{id}` makes — a new name, or the current settings in place
 * of the old. The endpoint and its hook were written and nothing called them,
 * so a set could only be deleted and kept again to change either.
 *
 * "Use current settings" sends the working set whole, `baseTemplateId`
 * included: the patch is all-or-nothing on the settings (`CustomizationPatch`),
 * because five knobs read together describe one page and four of them would
 * describe a page nobody chose.
 */
function SavedRow({
  row,
  defaults,
  remove,
}: {
  row: Customization;
  defaults: Preferences['defaults'];
  remove: React.ReactNode;
}) {
  const t = useTranslations('Appearance.presets');
  const families = useTranslations('Appearance.fontFamilies');
  const format = useFormatter();
  const patch = usePatchCustomization();
  const nameId = useId();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(row.name ?? '');

  const number = (value: number | undefined, digits: number) =>
    value === undefined ? '—' : format.number(value, { maximumFractionDigits: digits });

  return (
    <li className="bg-background/60 flex flex-col gap-3 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 font-medium">
            {row.accentColor && (
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-full border"
                style={{ backgroundColor: `#${row.accentColor}` }}
              />
            )}
            {row.name}
          </span>
          <span className="text-muted-foreground text-xs">
            {t('builtOn', { template: row.baseTemplateId ?? '' })}
            {' · '}
            {t('savedSummary', {
              family: row.fontFamily ? families(row.fontFamily) : '—',
              size: number(row.fontSizePt, 1),
              margin: number(row.marginInches, 2),
              spacing: number(row.lineSpacing, 2),
            })}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={renaming}
            onClick={() => setRenaming((open) => !open)}
          >
            {t('rename')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={patch.isPending}
            title={t('updateHint', { name: row.name ?? '' })}
            onClick={() =>
              patch.mutate(
                {
                  id: row.id!,
                  body: {
                    baseTemplateId: defaults?.templateId ?? 'classic',
                    ...(defaults?.appearance ?? {}),
                  },
                },
                { onSuccess: () => announce(t('updated', { name: row.name ?? '' })) },
              )
            }
          >
            {t('update')}
          </Button>
          {remove}
        </span>
      </div>

      {renaming && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (trimmed === '' || patch.isPending) return;
            patch.mutate(
              { id: row.id!, body: { name: trimmed } },
              {
                onSuccess: () => {
                  setRenaming(false);
                  announce(t('renamed', { name: trimmed }));
                },
              },
            );
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={nameId}>{t('renameLabel', { name: row.name ?? '' })}</Label>
            <Input
              id={nameId}
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={patch.isPending || name.trim() === ''}>
            {t('renameSave')}
          </Button>
        </form>
      )}

      {patch.error && <ErrorPanel error={patch.error} onDismiss={patch.reset} />}
    </li>
  );
}
