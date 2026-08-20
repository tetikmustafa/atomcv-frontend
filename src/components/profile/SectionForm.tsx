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
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateSection } from '@/hooks/useProfile';
import { sectionForm, validationKey, type SectionFormValues } from '@/lib/forms/profileSchemas';
import { announce } from '@/stores/announcerStore';

const KINDS = sectionForm.shape.kind.options;

export type SectionFormProps = { onDone: () => void };

export function SectionForm({ onDone }: SectionFormProps) {
  const t = useTranslations('Editor.addSection');
  const tk = useTranslations('Editor.sectionKind');
  const tv = useTranslations('Editor.validation');
  const create = useCreateSection();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SectionFormValues>({
    resolver: zodResolver(sectionForm),
    defaultValues: { kind: 'custom', title: '' },
  });

  const submit = handleSubmit((values) => {
    if (create.isPending) return;

    create.mutate(values, {
      onSuccess: (section) => {
        reset();
        onDone();
        announce(t('added', { title: section.title ?? values.title }));
      },
    });
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="section-kind">{t('kind')}</Label>

        {/*
          A native `<select>`, not a Radix listbox. Bölüm 39.1 buys Radix for
          dialogs, tabs and menus — the widgets with no accessible native
          equivalent. A select has one, it is keyboard- and screen-reader
          correct without help, and on a phone it is the platform picker. Rule
          4 makes the rest of the argument: this is the least-used control here
          and it would not be worth kilobytes.
        */}
        <select
          id="section-kind"
          {...register('kind')}
          className="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {tk(kind)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="section-title">{t('title')}</Label>
        <Input
          id="section-title"
          {...register('title')}
          aria-invalid={errors.title ? true : undefined}
          {...(errors.title ? { 'aria-describedby': 'section-title-error' } : {})}
        />
        {errors.title && (
          <p id="section-title-error" role="alert" className="text-destructive text-xs">
            {/* The schema carries a key, not a sentence — resolved here, the
                same way a server error code is (rule 8). */}
            {tv(validationKey(errors.title.message))}
          </p>
        )}
      </div>

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
            reset();
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
