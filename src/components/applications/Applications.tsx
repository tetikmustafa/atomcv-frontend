'use client';

/**
 * Where somebody applied, with which resume, and what came of it (§ 55,
 * `B-093`).
 *
 * **The whole list, unpaged.** It is a table somebody scans rather than a
 * feed they scroll, so the endpoint answers with all of it and there is no
 * "load more" to draw.
 *
 * **No transition is locked.** The five states are a closed vocabulary and
 * every move between them is allowed: a company that reopens a closed process
 * is not a data error, and the product does not argue with somebody about
 * what happened to them. A select with every option is the honest control.
 *
 * **A row whose `generationId` is null is one whose CV was deleted**, not one
 * that never had a resume attached. The record of applying outlives the
 * document (`ON DELETE SET NULL`), so those rows keep their place and lose
 * their download — offering one would be a link to a `404`.
 */

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useApplications,
  useCreateApplication,
  useDeleteApplication,
  usePatchApplication,
} from '@/hooks/useApplications';
import { useSession } from '@/hooks/useSession';
import { APPLICATION_STATUSES, type Application } from '@/lib/api/endpoints/applications';
import { Link } from '@/lib/i18n/navigation';
import { announce } from '@/stores/announcerStore';

export function Applications() {
  const { data: session } = useSession();

  // Three states, not two: `undefined` is "the session has not answered yet",
  // and either sentence shown there makes a claim about the reader that may
  // be wrong.
  if (!session) return null;
  if (!session.authenticated) return <NoAccount />;

  return <ApplicationList />;
}

function NoAccount() {
  const t = useTranslations('Applications');

  /*
    A note rather than a warning, and it says why rather than "sign in to
    unlock": a record of applying has to outlive the two-hour anonymous
    session to be worth anything, so this is one of the few places where the
    narrower product is narrower for a reason the reader can see.
  */
  return (
    <p className="border-border bg-muted/50 rounded-md border px-3 py-2 text-sm">
      {t.rich('anonymous', {
        link: (chunks) => (
          <Link href="/login?next=%2Fapplications" className="underline underline-offset-4">
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}

function ApplicationList() {
  const t = useTranslations('Applications');
  const { data: rows, isPending, isError } = useApplications(true);
  const create = useCreateApplication();

  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');

  function submit() {
    if (company.trim() === '' || position.trim() === '') return;

    create.mutate(
      // `status` and `appliedAt` are left out, and the server reads that as
      // `applied` and today — which is what somebody who has just pressed the
      // button means. Sending them would be this screen deciding something it
      // was never asked about.
      { company: company.trim(), position: position.trim() },
      {
        onSuccess: () => {
          setCompany('');
          setPosition('');
          announce(t('added'));
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="border-border flex flex-col gap-3 rounded-md border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h2 className="text-base font-medium">{t('addTitle')}</h2>

        <div className="flex flex-wrap gap-3">
          <div className="flex min-w-48 flex-1 flex-col gap-2">
            <Label htmlFor="application-company">{t('company')}</Label>
            <Input
              id="application-company"
              value={company}
              maxLength={200}
              onChange={(event) => setCompany(event.target.value)}
            />
          </div>

          <div className="flex min-w-48 flex-1 flex-col gap-2">
            <Label htmlFor="application-position">{t('position')}</Label>
            <Input
              id="application-position"
              value={position}
              maxLength={200}
              onChange={(event) => setPosition(event.target.value)}
            />
          </div>
        </div>

        {create.error && <ErrorPanel error={create.error} />}

        <Button
          type="submit"
          className="w-fit"
          disabled={create.isPending || company.trim() === '' || position.trim() === ''}
        >
          {create.isPending ? t('adding') : t('add')}
        </Button>
      </form>

      {isPending && <p className="text-muted-foreground text-sm">{t('loading')}</p>}
      {/* Nothing is rendered from a failed read: an empty list would say "you
          have applied nowhere", which is a different and wrong sentence. */}
      {isError && <p className="text-sm">{t('failed')}</p>}

      {rows?.length === 0 && <p className="text-muted-foreground text-sm">{t('empty')}</p>}

      {rows && rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Row row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ row }: { row: Application }) {
  const t = useTranslations('Applications');
  const format = useFormatter();
  const patch = usePatchApplication();
  const remove = useDeleteApplication();

  const [notes, setNotes] = useState(row.notes ?? '');
  const [open, setOpen] = useState(false);

  const id = row.id!;
  const version = row.version!;

  function move(status: string) {
    patch.mutate(
      // Only the field that changed. The endpoint is partial for exactly this
      // reason: sending the notes back would overwrite an edit made in
      // another tab, and moving a row is not a claim about its notes.
      { id, version, body: { status: status as Application['status'] } },
      { onSuccess: () => announce(t('moved', { status })) },
    );
  }

  function saveNotes() {
    const text = notes.trim();

    patch.mutate({
      id,
      version,
      // `notes: null` means "leave them alone" everywhere in this API, so
      // emptying them is its own field. One value cannot mean both.
      body: text === '' ? { clearNotes: true } : { notes: text },
    });
  }

  return (
    <div className="border-border flex flex-col gap-3 rounded-md border p-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-medium">{row.position}</span>
        <span className="text-muted-foreground text-sm">{row.company}</span>
        {row.appliedAt && (
          <span className="text-muted-foreground text-xs">
            {/* Rule 9: a date is never hand-formatted. This one is in the
                reader's own language — it is the interface, not a CV. */}
            {format.dateTime(new Date(row.appliedAt), 'short')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor={`status-${id}`} className="text-sm font-normal">
          {t('status')}
        </Label>

        {/*
          Every option, always. No transition is forbidden — which means no
          option here may be disabled, or the screen would be enforcing a rule
          the server does not have.
        */}
        <select
          id={`status-${id}`}
          value={row.status}
          disabled={patch.isPending}
          onChange={(event) => move(event.target.value)}
          className="border-border bg-background rounded-md border px-2 py-1 text-sm"
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}` as 'statuses.applied')}
            </option>
          ))}
        </select>

        {/*
          Null means the CV was deleted, and the record of applying survived
          it. There is nothing to download, so nothing is offered — a button
          leading to a `404` is worse than an absence the sentence explains.
        */}
        {row.generationId ? (
          <Link
            href={`/generations/${row.generationId}`}
            className="text-sm underline underline-offset-4"
          >
            {t('openResume')}
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs">{t('resumeDeleted')}</span>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {t('notes')}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={remove.isPending}
          onClick={() => remove.mutate({ id, version })}
          className="ml-auto"
        >
          {t('forget')}
        </Button>
      </div>

      {open && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`notes-${id}`}>{t('notesLabel')}</Label>
          <Textarea
            id={`notes-${id}`}
            rows={3}
            maxLength={5000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={patch.isPending}
            onClick={saveNotes}
          >
            {t('saveNotes')}
          </Button>
        </div>
      )}

      {/*
        `412` and `428` both land here, and both are somebody else's edit
        arriving first rather than anything this reader did wrong. The panel
        renders the server's own resolutions; the list refetches on every
        write, so the next attempt carries the version that won.
      */}
      {patch.error && <ErrorPanel error={patch.error} />}
      {remove.error && <ErrorPanel error={remove.error} />}
    </div>
  );
}
