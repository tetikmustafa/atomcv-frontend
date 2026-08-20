'use client';

/**
 * The entry form itself, split from `AddEntry` so React Hook Form and Zod stay
 * out of the profile route's initial bundle — the same 75 KB and the same
 * reason as `SectionForm`.
 *
 * This is the form the validation stack was brought in for. One required
 * field, two optional dates, and a rule spanning them: an end before a start.
 * The server accepts that with a `201` — verified — and the entry heading then
 * reads "May 2023 - May 2020" for good. Raised as `F-002`; until the server
 * refuses it, this does.
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
import { useCreateEntry } from '@/hooks/useProfile';
import {
  entryForm,
  toEntryCreate,
  validationKey,
  type EntryFormValues,
} from '@/lib/forms/profileSchemas';
import { announce } from '@/stores/announcerStore';
import type { Section } from '@/lib/api/endpoints/profile';

export type EntryFormProps = { section: Section; onDone: () => void };

const EMPTY: EntryFormValues = {
  title: '',
  organization: '',
  location: '',
  startDate: '',
  endDate: '',
};

export function EntryForm({ section, onDone }: EntryFormProps) {
  const t = useTranslations('Editor.addEntry');
  const tv = useTranslations('Editor.validation');
  const create = useCreateEntry();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entryForm),
    defaultValues: EMPTY,
  });

  const submit = handleSubmit((values) => {
    if (create.isPending) return;

    create.mutate(toEntryCreate(section.id!, values), {
      onSuccess: (entry) => {
        reset(EMPTY);
        onDone();
        announce(t('added', { title: entry.title ?? values.title }));
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
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? t('adding') : t('submit')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={create.isPending}
          onClick={() => {
            reset(EMPTY);
            create.reset();
            onDone();
          }}
        >
          {t('cancel')}
        </Button>
      </div>

      {create.error ? <ErrorPanel error={create.error} onRetry={() => create.reset()} /> : null}
    </form>
  );
}
