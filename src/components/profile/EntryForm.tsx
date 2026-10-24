'use client';

/**
 * The entry form itself, split from `AddEntry` so React Hook Form and Zod stay
 * out of the profile route's initial bundle — the same 75 KB and the same
 * reason as `SectionForm`.
 *
 * This is the form the validation stack was brought in for. One required
 * field, two optional dates, and a rule spanning them: an end before a start.
 * The server used to accept that with a `201`, leaving the heading reading
 * "May 2023 - May 2020" for good; `F-002` closed and it is a `400` now. The
 * check stays here anyway — it answers without a round trip and it answers
 * next to the field, which a `400` cannot.
 *
 * The same form edits an existing entry. Fields, schema, error wiring and
 * labels are identical, so a second component would be this one with its own
 * bugs; only the mutation, the defaults and three strings differ. Editing
 * sends every field it shows — see `toEntryPatch` for why that is not
 * optional.
 *
 * `type="date"` rather than a picker component: keyboard-accessible and
 * localised by the platform for free, and it hands back exactly the
 * `YYYY-MM-DD` the API wants, with no parsing in between to get a timezone
 * wrong in.
 */

import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateEntry, usePatchEntry } from '@/hooks/useProfile';
import { ImportanceSlider } from '@/components/profile/ImportanceSlider';
import { Switch } from '@/components/ui/switch';
import { useCapabilities } from '@/hooks/useSession';
import {
  DEFAULT_ENTRY_CONTROLS,
  entryForm,
  MIN_ATOMS_RANGE,
  toEntryCreate,
  toEntryPatch,
  validationKey,
  type EntryControls,
  type EntryFormValues,
} from '@/lib/forms/profileSchemas';
import { announce } from '@/stores/announcerStore';
import type { Entry, Section } from '@/lib/api/endpoints/profile';

/** `entry` present means editing that one; absent means adding to `section`. */
export type EntryFormProps = { section: Section; entry?: Entry; onDone: () => void };

const EMPTY: EntryFormValues = {
  title: '',
  organization: '',
  location: '',
  url: '',
  startDate: '',
  endDate: '',
};

/** The three switches, in the order the atom's own controls use. */
const SWITCHES = ['active', 'alwaysInclude', 'verbatim'] as const;

export function EntryForm({ section, entry, onDone }: EntryFormProps) {
  const t = useTranslations('Editor.addEntry');
  const te = useTranslations('Editor.editEntry');
  const tv = useTranslations('Editor.validation');
  const ta = useTranslations('Editor.atom');
  const create = useCreateEntry();
  const patch = usePatchEntry();

  const editing = entry !== undefined;
  /**
   * The entry-level controls (§ 14) — the same `canEditAtomControls` gate as
   * an atom's, and for the same reason: § 9 gives an anonymous session the
   * content and not the controls. Absent from the request when the gate is
   * closed, so a guest's form can never send them.
   */
  const canControl = useCapabilities()?.canEditAtomControls === true;
  const [controls, setControls] = useState<EntryControls>(
    entry
      ? {
          importance: entry.importance ?? DEFAULT_ENTRY_CONTROLS.importance,
          active: entry.active ?? true,
          alwaysInclude: entry.alwaysInclude ?? false,
          verbatim: entry.verbatim ?? false,
          minAtoms: entry.minAtoms ?? DEFAULT_ENTRY_CONTROLS.minAtoms,
        }
      : DEFAULT_ENTRY_CONTROLS,
  );
  const minAtomsValid =
    Number.isInteger(controls.minAtoms) &&
    controls.minAtoms >= MIN_ATOMS_RANGE.min &&
    controls.minAtoms <= MIN_ATOMS_RANGE.max;
  const controlsId = useId();
  const pending = editing ? patch.isPending : create.isPending;
  const error = editing ? patch.error : create.error;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entryForm),
    // The inputs are never `undefined`: an uncontrolled field that starts
    // undefined and later receives a value logs React's controlled/uncontrolled
    // warning and loses the first keystroke.
    defaultValues: entry
      ? {
          title: entry.title ?? '',
          organization: entry.organization ?? '',
          location: entry.location ?? '',
          startDate: entry.startDate ?? '',
          endDate: entry.endDate ?? '',
          url: entry.url ?? '',
        }
      : EMPTY,
  });

  const submit = handleSubmit((values) => {
    if (pending || (canControl && !minAtomsValid)) return;
    const sent = canControl ? controls : undefined;

    if (editing) {
      patch.mutate(
        { id: entry.id!, patch: toEntryPatch(values, sent) },
        {
          onSuccess: (updated) => {
            onDone();
            announce(te('saved', { title: updated.title ?? values.title }));
          },
        },
      );
      return;
    }

    create.mutate(toEntryCreate(section.id!, values, sent), {
      onSuccess: (created) => {
        reset(EMPTY);
        onDone();
        announce(t('added', { title: created.title ?? values.title }));
      },
    });
  });

  const field = (
    name: keyof EntryFormValues,
    label: string,
    type: 'text' | 'date' | 'url' = 'text',
    required = false,
  ) => {
    const fieldId = `${controlsId}-field-${name}`;
    const errorId = `${fieldId}-error`;
    const message = errors[name]?.message;

    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId}>{label}</Label>
        <Input
          id={fieldId}
          type={type}
          {...register(name)}
          {...(required ? { 'aria-required': true } : {})}
          aria-invalid={message ? true : undefined}
          {...(message ? { 'aria-describedby': errorId } : {})}
        />
        {message && (
          <p id={errorId} role="alert" className="text-destructive text-xs">
            {/* A key, not a sentence — resolved through next-intl exactly as a
                server error code is (rule 8), so both read in one language. */}
            {tv(validationKey(message))}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="bg-card shadow-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
    >
      {field('title', t('title'), 'text', true)}
      <div className="grid gap-4 sm:grid-cols-2">
        {field('organization', t('organization'))}
        {field('location', t('location'))}
      </div>
      {field('url', t('url'), 'url')}
      <p className="text-muted-foreground -mt-2 text-xs">{t('urlHint')}</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">{field('startDate', t('startDate'), 'date')}</div>
        {/* Left blank on purpose means "still there" — said next to the field
            rather than left for the user to infer from an empty box. */}
        <div className="flex-1">{field('endDate', t('endDate'), 'date')}</div>
      </div>

      <p className="text-muted-foreground text-xs">{t('endDateHint')}</p>

      {canControl && (
        <fieldset className="bg-muted/40 flex flex-col gap-4 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">{t('controls')}</legend>
          <ImportanceSlider
            value={controls.importance}
            onChange={(importance) => setControls((current) => ({ ...current, importance }))}
          />
          <ul className="flex flex-col gap-3">
            {SWITCHES.filter((name) => editing || name !== 'active').map((name) => (
              <li key={name} className="flex items-start gap-3">
                <Switch
                  id={`${controlsId}-${name}`}
                  aria-describedby={`${controlsId}-${name}-hint`}
                  checked={controls[name]}
                  onCheckedChange={(next) =>
                    setControls((current) => ({ ...current, [name]: next }))
                  }
                />
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor={`${controlsId}-${name}`}>{ta(`${name}.label`)}</Label>
                  <p id={`${controlsId}-${name}-hint`} className="text-muted-foreground text-xs">
                    {ta(`${name}.hint`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${controlsId}-minAtoms`}>{t('minAtoms')}</Label>
            <Input
              id={`${controlsId}-minAtoms`}
              type="number"
              inputMode="numeric"
              min={MIN_ATOMS_RANGE.min}
              max={MIN_ATOMS_RANGE.max}
              step={1}
              className="w-28"
              value={Number.isNaN(controls.minAtoms) ? '' : controls.minAtoms}
              aria-invalid={minAtomsValid ? undefined : true}
              aria-describedby={`${controlsId}-minAtoms-hint`}
              onChange={(event) =>
                setControls((current) => ({ ...current, minAtoms: event.target.valueAsNumber }))
              }
            />
            <p id={`${controlsId}-minAtoms-hint`} className="text-muted-foreground text-xs">
              {minAtomsValid ? t('minAtomsHint') : tv('minAtomsRange')}
            </p>
          </div>
        </fieldset>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (editing ? te('saving') : t('adding')) : editing ? te('submit') : t('submit')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            reset(EMPTY);
            create.reset();
            patch.reset();
            onDone();
          }}
        >
          {t('cancel')}
        </Button>
      </div>

      {error ? (
        <ErrorPanel
          error={error}
          onRetry={() => {
            create.reset();
            patch.reset();
          }}
        />
      ) : null}
    </form>
  );
}
