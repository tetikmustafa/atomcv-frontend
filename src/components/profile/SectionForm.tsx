'use client';

/**
 * The section form itself, split from `AddSection` so that React Hook Form and
 * Zod are **not in the profile route's initial bundle**.
 *
 * They cost 75 KB gzipped between them — measured, not estimated: landing them
 * eagerly took this route's own share from 70.7 KB to 145.7 KB and broke the
 * ceiling in `bundle-budget.json`. Rule 4 is the standing answer to that, and
 * this form is the ideal shape for it: it lives behind a button and most
 * sessions never open it.
 *
 * `ssr: false` at the import site, because there is nothing to server-render —
 * the form only exists after a click.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { useCapabilities } from '@/hooks/useSession';
import { useCreateSection, usePatchSection } from '@/hooks/useProfile';
import {
  DEFAULT_LAYOUT,
  DEFAULT_SECTION_CONTROLS,
  sectionForm,
  validationKey,
  type SectionControls,
  type SectionFormValues,
} from '@/lib/forms/profileSchemas';
import { announce } from '@/stores/announcerStore';
import type { Section } from '@/lib/api/endpoints/profile';

/** The switches, with the message keys each one reads. */
const SWITCHES = [
  { name: 'active', label: 'sectionActive' },
  { name: 'alwaysInclude', label: 'sectionAlwaysInclude' },
  { name: 'verbatim', label: 'sectionVerbatim' },
] as const;

const KINDS = sectionForm.shape.kind.options;
const LAYOUTS = sectionForm.shape.layout.options;

/**
 * `section` present means editing that one; absent means adding.
 *
 * One form for both, because the fields, the schema, the error wiring and the
 * labels are identical — a second copy would be the same form with its own
 * bugs. Only the mutation and four strings differ.
 */
export type SectionFormProps = { section?: Section; onDone: () => void };

export function SectionForm({ section, onDone }: SectionFormProps) {
  const t = useTranslations('Editor.addSection');
  const te = useTranslations('Editor.editSection');
  const tk = useTranslations('Editor.sectionKind');
  const tl = useTranslations('Editor.sectionLayout');
  const tv = useTranslations('Editor.validation');
  const create = useCreateSection();
  const patch = usePatchSection();

  const editing = section !== undefined;
  /**
   * A section's own switches (§ 14), behind the same gate an atom's are.
   * `active` is an edit's: the create body has no such field, and a new
   * section is in use.
   */
  const canControl = useCapabilities()?.canEditAtomControls === true;
  const [controls, setControls] = useState<SectionControls>(
    section
      ? {
          active: section.active ?? true,
          alwaysInclude: section.alwaysInclude ?? false,
          verbatim: section.verbatim ?? false,
        }
      : DEFAULT_SECTION_CONTROLS,
  );
  const controlsId = useId();
  const pending = editing ? patch.isPending : create.isPending;
  const error = editing ? patch.error : create.error;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SectionFormValues>({
    resolver: zodResolver(sectionForm),
    defaultValues: {
      kind: section?.kind ?? 'custom',
      title: section?.title ?? '',
      /*
        The section's own layout when editing; when adding, the one this kind
        is usually set as (§ 33.4.1). Not a fixed `bullet_list`: the server
        already writes the right one per kind, and a form that always
        suggested bullets would be arguing with it — About most of all, where
        a summary printed as a list reads as the first item of a list that
        never comes.
      */
      layout: section?.layout ?? DEFAULT_LAYOUT.custom,
    },
  });

  /*
    Changing the kind moves the suggestion with it, but **only while the
    reader has not chosen one**. Somebody who picked `paragraph` and then
    corrected the kind has made a decision, and overwriting it would be the
    form deciding it knew better.
  */
  const [layoutTouched, setLayoutTouched] = useState(editing);

  const submit = handleSubmit((values) => {
    if (pending) return;

    if (editing) {
      patch.mutate(
        { id: section.id!, patch: canControl ? { ...values, ...controls } : values },
        {
          onSuccess: (updated) => {
            onDone();
            announce(te('saved', { title: updated.title ?? values.title }));
          },
        },
      );
      return;
    }

    const creatable = { alwaysInclude: controls.alwaysInclude, verbatim: controls.verbatim };
    create.mutate(canControl ? { ...values, ...creatable } : values, {
      onSuccess: (created) => {
        reset();
        onDone();
        announce(t('added', { title: created.title ?? values.title }));
      },
    });
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="bg-card shadow-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${controlsId}-kind`}>{t('kind')}</Label>

        {/*
          A native `<select>`, not a Radix listbox. Bölüm 39.1 buys Radix for
          dialogs, tabs and menus — the widgets with no accessible native
          equivalent. A select has one, it is keyboard- and screen-reader
          correct without help, and on a phone it is the platform picker. Rule
          4 makes the rest of the argument: this is the least-used control here
          and it would not be worth kilobytes.
        */}
        <NativeSelect
          className="sm:w-full"
          id={`${controlsId}-kind`}
          {...register('kind', {
            /*
              Moved in the handler rather than in an effect watching `kind`.
              An effect would be state reacting to state — and the rule-of-hooks
              lint says so — where this is what it actually is: one thing
              happening because somebody changed a dropdown.
            */
            onChange: (event: ChangeEvent<HTMLSelectElement>) => {
              if (layoutTouched) return;
              setValue('layout', DEFAULT_LAYOUT[event.target.value as SectionFormValues['kind']]);
            },
          })}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {tk(kind)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${controlsId}-layout`}>{t('layout')}</Label>
        <p id={`${controlsId}-layout-hint`} className="text-muted-foreground text-xs">
          {t('layoutHint')}
        </p>

        {/*
          Four values, not five (`B-116`). `two_column` was accepted by the
          endpoint, allowed by the CHECK, published by the schema -- and
          printed as an entry list anyway, because all three templates are
          single-column for an ATS-extraction reason. A person chose a layout,
          nothing said otherwise, and their document printed a different one.

          Drawing this at all was D13's call, and the gap it closes named its
          own condition: every value needs a word somebody can read, or the
          control hands out a choice whose meaning is unavailable.
        */}
        <NativeSelect
          className="sm:w-full"
          id={`${controlsId}-layout`}
          aria-describedby={`${controlsId}-layout-hint`}
          {...register('layout', { onChange: () => setLayoutTouched(true) })}
        >
          {LAYOUTS.map((layout) => (
            <option key={layout} value={layout}>
              {tl(layout)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${controlsId}-title`}>{t('title')}</Label>
        <Input
          id={`${controlsId}-title`}
          {...register('title')}
          aria-invalid={errors.title ? true : undefined}
          {...(errors.title ? { 'aria-describedby': `${controlsId}-title-error` } : {})}
        />
        {errors.title && (
          <p id={`${controlsId}-title-error`} role="alert" className="text-destructive text-xs">
            {/* The schema carries a key, not a sentence — resolved here, the
                same way a server error code is (rule 8). */}
            {tv(validationKey(errors.title.message))}
          </p>
        )}
      </div>

      {canControl && (
        <fieldset className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">{t('controls')}</legend>
          <ul className="flex flex-col gap-3">
            {SWITCHES.filter(({ name }) => editing || name !== 'active').map(({ name, label }) => (
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
                  <Label htmlFor={`${controlsId}-${name}`}>{t(label)}</Label>
                  <p id={`${controlsId}-${name}-hint`} className="text-muted-foreground text-xs">
                    {t(`${label}Hint`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
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
            reset();
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
