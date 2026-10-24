'use client';

/**
 * Where somebody applied, with which resume, and what came of it (§ 55,
 * `B-093`).
 *
 * **The whole list, unpaged.** It is a table somebody scans rather than a
 * feed they scroll, so the endpoint answers with all of it and there is no
 * "load more" to draw — and the status filter is a filter of what is already
 * here. `B-093` brings a server-side one with pagination; until then a filter
 * on the client is honest, because nothing is missing from the list it sorts.
 *
 * **No transition is locked.** The five states are a closed vocabulary and
 * every move between them is allowed: a company that reopens a closed process
 * is not a data error, and the product does not argue with somebody about
 * what happened to them. A select with every option is the honest control.
 *
 * **A row without a `generationId` has no resume to open** — either it was
 * recorded here by hand or its CV was deleted (`ON DELETE SET NULL`), and the
 * wire cannot tell those apart. This used to say "that resume has been
 * deleted" for every such row, which was false for every row the form above
 * creates. Nothing is offered and nothing is claimed; the result screen's
 * "track this application" is where a row gets its resume.
 */

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Briefcase, FileText, Pencil } from 'lucide-react';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { EmptyState } from '@/components/layout/EmptyState';
import { DeleteControl } from '@/components/profile/DeleteControl';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  useApplications,
  useCreateApplication,
  useDeleteApplication,
  usePatchApplication,
} from '@/hooks/useApplications';
import { useGenerationHistory } from '@/hooks/useGeneration';
import { useSession } from '@/hooks/useSession';
import { APPLICATION_STATUSES, type Application } from '@/lib/api/endpoints/applications';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { announce } from '@/stores/announcerStore';

type Status = (typeof APPLICATION_STATUSES)[number];

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
    It says why rather than "sign in to unlock": a record of applying has to
    outlive the two-hour anonymous session to be worth anything, so this is
    one of the few places where the narrower product is narrower for a reason
    the reader can see.
  */
  return (
    <EmptyState
      icon={Briefcase}
      title={t('anonymousTitle')}
      description={t.rich('anonymous', {
        link: (chunks) => (
          <Link href="/login?next=%2Fapplications" className="underline underline-offset-4">
            {chunks}
          </Link>
        ),
      })}
    />
  );
}

function ApplicationList() {
  const t = useTranslations('Applications');
  const { data: rows, isPending, isError } = useApplications(true);
  const create = useCreateApplication();

  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [filter, setFilter] = useState<Status | 'all'>('all');

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

  const counts = new Map<Status, number>();
  for (const row of rows ?? []) {
    counts.set(row.status as Status, (counts.get(row.status as Status) ?? 0) + 1);
  }
  const shown = (rows ?? []).filter((row) => filter === 'all' || row.status === filter);

  return (
    <div className="flex flex-col gap-6">
      <form
        className="bg-card shadow-card flex flex-col gap-4 rounded-xl border p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h2 className="text-base font-semibold">{t('addTitle')}</h2>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="application-company">{t('company')}</Label>
            <Input
              id="application-company"
              value={company}
              maxLength={200}
              onChange={(event) => setCompany(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="application-position">{t('position')}</Label>
            <Input
              id="application-position"
              value={position}
              maxLength={200}
              onChange={(event) => setPosition(event.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={create.isPending || company.trim() === '' || position.trim() === ''}
          >
            {create.isPending ? t('adding') : t('add')}
          </Button>
        </div>

        {create.error && <ErrorPanel error={create.error} />}
      </form>

      {isPending && (
        <div className="flex flex-col gap-3">
          <p role="status" className="sr-only">
            {t('loading')}
          </p>
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      )}
      {/* Nothing is rendered from a failed read: an empty list would say "you
          have applied nowhere", which is a different and wrong sentence. */}
      {isError && <p className="text-sm">{t('failed')}</p>}

      {rows?.length === 0 && <EmptyState icon={Briefcase} title={t('empty')} />}

      {rows && rows.length > 0 && (
        <>
          <h2 className="text-base font-semibold">{t('listTitle')}</h2>
          {/*
            Buttons that say whether they are pressed, rather than a select:
            the counts are the point, and a select hides all but one of them.
          */}
          <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
              {t('filterAll', { count: rows.length })}
            </FilterButton>
            {APPLICATION_STATUSES.filter((status) => counts.has(status)).map((status) => (
              <FilterButton
                key={status}
                active={filter === status}
                onClick={() => setFilter(status)}
              >
                {t('filterStatus', { status, count: counts.get(status) ?? 0 })}
              </FilterButton>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('noneInFilter')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((row) => (
                <li key={row.id}>
                  <Row row={row} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/50 rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-3',
        active
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Row({ row }: { row: Application }) {
  const t = useTranslations('Applications');
  const format = useFormatter();
  const patch = usePatchApplication();
  const remove = useDeleteApplication();

  const [notes, setNotes] = useState(row.notes ?? '');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

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
    <Card className="gap-4">
      <div className="flex items-start gap-3">
        <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Briefcase className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle as="h3" className="text-base">
            {row.position}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {row.company}
            {row.appliedAt && (
              <>
                {' · '}
                {/* Rule 9: a date is never hand-formatted. This one is in the
                    reader's own language — it is the interface, not a CV.

                    A calendar day (`format: date`), so `day` and in UTC:
                    `new Date('2026-10-24')` is midnight UTC, which `short`
                    printed as "24 Oct 2026, 03:00" in Istanbul — an hour
                    nobody applied at — and which west of Greenwich is the
                    23rd. */}
                {t('appliedOn', {
                  date: format.dateTime(new Date(row.appliedAt), 'day', { timeZone: 'UTC' }),
                })}
              </>
            )}
          </p>
        </div>
        <Badge
          variant={row.status === 'rejected' || row.status === 'withdrawn' ? 'muted' : 'secondary'}
        >
          {t(`statuses.${row.status as Status}`)}
        </Badge>
      </div>

      {editing ? (
        <EditForm row={row} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor={`status-${id}`} className="text-sm font-normal">
              {t('status')}
            </Label>

            {/*
              Every option, always. No transition is forbidden — which means no
              option here may be disabled, or the screen would be enforcing a
              rule the server does not have.
            */}
            <NativeSelect
              id={`status-${id}`}
              value={row.status}
              disabled={patch.isPending}
              onChange={(event) => move(event.target.value)}
            >
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`statuses.${status}`)}
                </option>
              ))}
            </NativeSelect>
          </div>

          {row.generationId && (
            <Link
              href={`/generations/${row.generationId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <FileText aria-hidden="true" />
              {t('openResume')}
            </Link>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-1">
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
              aria-label={t('editTitle', { company: row.company ?? '' })}
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden="true" />
              {t('edit')}
            </Button>
            {/*
              Behind the same confirmation every other deletion in the product
              has. It went on the first press, which no other delete does.
            */}
            <DeleteControl
              triggerLabel={t('forgetTrigger', {
                position: row.position ?? '',
                company: row.company ?? '',
              })}
              title={t('forgetTitle')}
              description={t('forgetBody', {
                position: row.position ?? '',
                company: row.company ?? '',
              })}
              confirmLabel={t('forgetConfirm')}
              onConfirm={() => remove.mutateAsync({ id, version })}
              isPending={remove.isPending}
              error={remove.error}
              onReset={remove.reset}
            />
          </div>
        </div>
      )}

      {open && !editing && (
        <div className="flex flex-col gap-2 border-t pt-4">
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
    </Card>
  );
}

/**
 * The fields `ApplicationUpdate` takes that the row could not change before:
 * the company, the position and the date applied. A typo in an employer's
 * name used to be fixable only by forgetting the row and adding it again,
 * which also lost its status, its notes and its resume.
 */
function EditForm({ row, onDone }: { row: Application; onDone: () => void }) {
  const t = useTranslations('Applications');
  const patch = usePatchApplication();
  const [company, setCompany] = useState(row.company ?? '');
  const [position, setPosition] = useState(row.position ?? '');
  const [appliedAt, setAppliedAt] = useState(row.appliedAt?.slice(0, 10) ?? '');
  const [generationId, setGenerationId] = useState(row.generationId ?? '');
  const id = row.id!;

  return (
    <form
      className="flex flex-col gap-3 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (patch.isPending || !company.trim() || !position.trim()) return;
        patch.mutate(
          {
            id,
            version: row.version!,
            body: {
              company: company.trim(),
              position: position.trim(),
              ...(appliedAt ? { appliedAt } : {}),
              // Sent only when it changed. The update has no way to clear a
              // link, so "not linked" is offered only to a row that has none.
              ...(generationId && generationId !== row.generationId ? { generationId } : {}),
            },
          },
          { onSuccess: onDone },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`company-${id}`}>{t('company')}</Label>
          <Input
            id={`company-${id}`}
            value={company}
            maxLength={200}
            onChange={(event) => setCompany(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`position-${id}`}>{t('position')}</Label>
          <Input
            id={`position-${id}`}
            value={position}
            maxLength={200}
            onChange={(event) => setPosition(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`applied-${id}`}>{t('appliedAt')}</Label>
          <Input
            id={`applied-${id}`}
            type="date"
            value={appliedAt}
            onChange={(event) => setAppliedAt(event.target.value)}
          />
        </div>
      </div>
      <ResumeSelect
        id={`resume-${id}`}
        value={generationId}
        linked={row.generationId}
        onChange={setGenerationId}
      />
      {patch.error && <ErrorPanel error={patch.error} />}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={patch.isPending}>
          {patch.isPending ? t('saving') : t('save')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Which resume went with this application (`ApplicationUpdate.generationId`).
 *
 * The row's "Open the resume" link is only as good as this value, and until
 * now nothing could set it after the fact: a row recorded by hand stayed
 * unlinked for good. The history is read when the form opens, not before —
 * most visits to this screen never edit a row.
 */
function ResumeSelect({
  id,
  value,
  linked,
  onChange,
}: {
  id: string;
  value: string;
  linked: string | undefined;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('Applications');
  const format = useFormatter();
  const history = useGenerationHistory();
  const items = history.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  // A link to a resume older than the first page is still the row's value;
  // it stays selectable rather than silently reading as another one.
  const linkedMissing = linked !== undefined && !items.some((item) => item.generationId === linked);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t('resume')}</Label>
      <NativeSelect
        id={id}
        value={value}
        aria-describedby={`${id}-hint`}
        disabled={history.isPending}
        onChange={(event) => onChange(event.target.value)}
      >
        {linked === undefined && <option value="">{t('resumeNone')}</option>}
        {linkedMissing && <option value={linked}>{t('resumeLinked')}</option>}
        {items.map((item) => (
          <option key={item.generationId} value={item.generationId}>
            {item.companyName
              ? t('resumeOptionAt', {
                  role: item.roleTitle ?? t('resumeGeneral'),
                  company: item.companyName,
                  date: format.dateTime(new Date(item.createdAt!), { dateStyle: 'medium' }),
                })
              : t('resumeOption', {
                  role: item.roleTitle ?? t('resumeGeneral'),
                  date: format.dateTime(new Date(item.createdAt!), { dateStyle: 'medium' }),
                })}
          </option>
        ))}
      </NativeSelect>
      <p id={`${id}-hint`} className="text-muted-foreground text-xs">
        {t('resumeHint')}
      </p>
    </div>
  );
}
