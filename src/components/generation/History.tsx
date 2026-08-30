'use client';

/**
 * The resumes this account has made (`B-066`).
 *
 * `capabilities.canSaveHistory` had nothing behind it until `GET /generations`
 * landed; this is what it now means.
 *
 * **The row is labelled with the role and the company** (`B-070`), which is
 * the whole of § 57.6's exception to absolute rule 4: enough of the posting to
 * *name* a generation, never enough to read it back. The two are independent —
 * a posting can name the job and not the employer — and neither ever arrives
 * empty, so there is no `''` to guard against. A generation made in general
 * mode has neither, and is named by its facts instead.
 *
 * **Paged by cursor, and the absence of the cursor is the end.** Nothing here
 * reads the value: it is the server's to write and ours to echo back.
 */

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useGenerationHistory } from '@/hooks/useGeneration';
import { useCapabilities } from '@/hooks/useSession';
import type { GenerationSummary } from '@/lib/api/endpoints/generations';
import { Link } from '@/lib/i18n/navigation';

export function History() {
  const capabilities = useCapabilities();

  // Three states, not two: `undefined` is "the session has not answered yet",
  // and drawing the anonymous sentence there would tell somebody with an
  // account that their history is not kept.
  if (capabilities === undefined) return null;
  if (!capabilities.canSaveHistory) return <NoHistoryKept />;

  return <HistoryList />;
}

function NoHistoryKept() {
  const t = useTranslations('History');

  // A note, not a warning. § 33.4: anonymous mode is fully functional and only
  // narrower — the resume is built and downloaded exactly as it would be, it
  // simply is not listed afterwards.
  return (
    <p className="border-border bg-muted/50 rounded-md border px-3 py-2 text-sm">
      {t('anonymous')}
    </p>
  );
}

function HistoryList() {
  const t = useTranslations('History');
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGenerationHistory();

  if (isPending) return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  // Nothing is rendered from a failed read — an empty list here would say
  // "you have made nothing", which is a different and wrong sentence.
  if (isError) return <p className="text-sm">{t('failed')}</p>;

  const rows = data.pages.flatMap((page) => page.items ?? []);
  // The account's own count, from the first page. `total` counts the account
  // rather than what has been walked to, so it does not climb as pages load.
  const total = data.pages[0]?.total ?? rows.length;

  if (rows.length === 0) return <p className="text-muted-foreground text-sm">{t('empty')}</p>;

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-muted-foreground text-sm">
        {t('shown', { shown: rows.length, total })}
      </p>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.generationId}>
            <Row row={row} />
          </li>
        ))}
      </ul>

      {/*
        Drawn on `hasNextPage` alone: the server says the history has ended by
        sending no cursor, and a button that waits for an empty page would ask
        one request more than there is anything to ask for.
      */}
      {hasNextPage && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? t('loadingMore') : t('more')}
        </Button>
      )}
    </div>
  );
}

function Row({ row }: { row: GenerationSummary }) {
  const t = useTranslations('History');
  // The match level's wording belongs to the fit report and is borrowed
  // rather than written again: two catalogues for one closed vocabulary drift,
  // and this screen would be the copy nobody notices is stale.
  const fit = useTranslations('Fit');
  const format = useFormatter();
  const locale = useLocale();

  const when = row.createdAt ? format.dateTime(new Date(row.createdAt), 'short') : '';
  const facts = [
    when,
    row.pageCount === undefined ? null : t('pages', { count: row.pageCount }),
    row.matchLevel ? fit('level', { level: row.matchLevel }) : null,
    languageName(row.contentLanguage, locale),
    row.hasCoverLetter ? t('withLetter') : null,
  ].filter(Boolean);

  /*
    Two elements rather than one string joined by a dash, and the reason is on
    the wire: measured against the real backend, a `roleTitle` can itself
    contain one — "Integration Engineer — Legacy Systems". A row reading
    "Integration Engineer — Legacy Systems — Acme" looks like a mistake, and
    nothing here can tell the reader which dash was ours.

    The accessible name joins them with a comma instead, which is what a
    screen reader wants anyway.
  */
  const label = [row.roleTitle, row.companyName].filter(Boolean);

  const body = (
    <>
      {label.length > 0 && (
        <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
          {row.roleTitle && <span className="font-medium">{row.roleTitle}</span>}
          {row.companyName && <span className="text-muted-foreground">{row.companyName}</span>}
        </span>
      )}
      <span className={label.length > 0 ? 'text-muted-foreground text-xs' : 'text-sm'}>
        {facts.join(' · ')}
      </span>
      {row.status && row.status !== 'completed' && (
        <span className="text-muted-foreground text-xs">{t('status', { status: row.status })}</span>
      )}
    </>
  );

  const className = 'border-border flex flex-col gap-1 rounded-md border px-3 py-2';

  /*
    A generation that did not finish has no document to open, so its row is
    not a link. Linking it would offer a screen whose only possible content is
    an error — the reader learns the same thing from the label, without the
    journey.
  */
  if (row.status === 'failed' || !row.generationId) {
    return <div className={className}>{body}</div>;
  }

  return (
    <Link
      href={`/generations/${row.generationId}`}
      // The label first, then the facts: a screen reader running through the
      // links hears what each generation was for, which is the question this
      // screen exists to answer. A row without a label falls back to its
      // facts, which is all it has.
      aria-label={t('open', { facts: [...label, ...facts].join(', ') })}
      className={`${className} hover:bg-muted/50 focus-visible:ring-ring block focus-visible:ring-3 focus-visible:outline-none`}
    >
      {body}
    </Link>
  );
}

/**
 * A BCP 47 tag as the reader's own word for that language (rule 9's spirit:
 * never hand-format what `Intl` knows).
 *
 * Falls back to the tag itself: an unknown or malformed value is shown as it
 * arrived rather than dropped, because a row missing one of its few facts is
 * harder to read than one carrying a raw `en-GB`.
 */
function languageName(tag: string | undefined, locale: string): string | null {
  if (!tag) return null;

  try {
    // Named in the **interface** language, not in the content language: the
    // person reading this list is the user. Dates written *inside* a generated
    // CV are the other rule, and the server's job.
    return new Intl.DisplayNames([locale], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
