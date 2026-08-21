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

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateEntry, usePatchEntry } from '@/hooks/useProfile';
import {
  entryForm,
  toEntryCreate,
  toEntryPatch,
  validationKey,
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
  startDate: '',
  endDate: '',
};

export function EntryForm({ section, entry, onDone }: EntryFormProps) {
  const t = useTranslations('Editor.addEntry');
  const te = useTranslations('Editor.editEntry');
  const tv = useTranslations('Editor.validation');
  const create = useCreateEntry();
  const patch = usePatchEntry();

  const editing = entry !== undefined;
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
        }
      : EMPTY,
  });

  const submit = handleSubmit((values) => {
    if (pending) return;

    if (editing) {
      patch.mutate(
        { id: entry.id!, patch: toEntryPatch(values) },
        {
          onSuccess: (updated) => {
            onDone();
            announce(te('saved', { title: updated.title ?? values.title }));
          },
        },
      );
      return;
    }

    create.mutate(toEntryCreate(section.id!, values), {
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
    type: 'text' | 'date' = 'text',
    required = false,
  ) => {
    const errorId = `entry-${name}-error`;
    const message = errors[name]?.message;

    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={`entry-${name}`}>{label}</Label>
        <Input
          id={`entry-${name}`}
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
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-lg border p-4">
      {field('title', t('title'), 'text', true)}
      {field('organization', t('organization'))}
      {field('location', t('location'))}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">{field('startDate', t('startDate'), 'date')}</div>
        {/* Left blank on purpose means "still there" — said next to the field
            rather than left for the user to infer from an empty box. */}
        <div className="flex-1">{field('endDate', t('endDate'), 'date')}</div>
      </div>

      <p className="text-muted-foreground text-xs">{t('endDateHint')}</p>

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
