'use client';

/**
 * A finished generation: what it is, how well it fits, and how to get it.
 *
 * It reads the generation rather than the job that made it. The screen is
 * reachable by URL — the progress screen replaces itself with it, and a
 * reload has to land somewhere real — so nothing it shows may depend on this
 * session having watched the job happen.
 *
 * The fit report is absent in general mode, and that is a different state
 * from "no skills matched": there was no posting to be relevant to. It is
 * said in words rather than drawn as a row of zeroes.
 */

import { useLocale, useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { ArchiveToggle } from '@/components/generation/ArchiveToggle';
import { CoverLetter } from '@/components/generation/CoverLetter';
import { EditRequest } from '@/components/generation/EditRequest';
import { Feedback } from '@/components/generation/Feedback';
import { SelectionEditor } from '@/components/generation/SelectionEditor';
import { FitReport } from '@/components/generation/FitReport';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { languageName } from '@/lib/i18n/languageNames';
import { useDownloadGeneration, useGenerationResult } from '@/hooks/useGeneration';
import { DOWNLOAD_EXTENSION, type DownloadFormat } from '@/lib/api/endpoints/generations';
import { useCanWriteCoverLetter, useIsAnonymous } from '@/hooks/useSession';
import { announce } from '@/stores/announcerStore';

/**
 * The primary subtag, for comparing two BCP 47 tags as *languages*.
 *
 * `en` and `en-GB` are one language written two ways, and a raw `!==` would
 * tell the reader their resume came out in the wrong one. `toLowerCase` is
 * not locale-sensitive — the explicit locale is there to say so, because rule
 * 11 is about the transform that is (`toLocaleLowerCase` under `tr`).
 */
function primaryLanguage(tag: string | undefined) {
  return tag?.split('-')[0]?.toLocaleLowerCase('en');
}

export function GenerationResult({ generationId }: { generationId: string }) {
  const t = useTranslations('Result');
  const locale = useLocale();
  const { data, isPending, error, refetch } = useGenerationResult(generationId);
  const download = useDownloadGeneration();
  // Which button is waiting. `variables` is the mutation's own record of what
  // was asked for, so there is no second piece of state to keep true.
  const pending = download.isPending ? download.variables.format : undefined;
  const canWriteCoverLetter = useCanWriteCoverLetter();
  const anonymous = useIsAnonymous();

  function save(format: DownloadFormat) {
    download.mutate(
      { generationId, format },
      {
        onSuccess: ({ blob, filename }) => {
          // The browser owns the save dialog; this only hands it the bytes.
          // A plain link would have been simpler and would have turned a `410`
          // into a page of JSON instead of an error with a way out of it.
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');

          anchor.href = url;
          // `DOWNLOAD_EXTENSION` rather than `format`: the query value names a
          // format and the file is a `.tex`, so interpolating would save
          // something called `atomcv-<id>.source` that nothing opens.
          anchor.download = filename ?? `atomcv-${generationId}.${DOWNLOAD_EXTENSION[format]}`;
          anchor.click();

          URL.revokeObjectURL(url);
          announce(t('announceDownloaded'));
        },
      },
    );
  }

  if (isPending) return <p className="text-muted-foreground text-sm">{t('loading')}</p>;

  // A failed read here is a 404 or a 5xx, and only the second is worth
  // repeating — `isRetriable` is what decides, inside the panel's own retry.
  if (error) return <ErrorPanel error={error} onRetry={() => void refetch()} />;

  /*
    B-042: `auto` resolves to the posting's language only when the profile can
    actually be written in it. When it could not, the two tags differ and the
    document is in the profile's language — which the reader is owed an
    explanation for, since they pasted an English posting and got a Turkish CV.

    A note, not a warning: nothing went wrong and there is nothing to retry.
    Both tags are optional on the wire and absent when blank, so the sentence
    is drawn only when both are there and they disagree.
  */
  const contentLang = primaryLanguage(data.contentLanguage);
  const postingLang = primaryLanguage(data.postingLanguage);
  const languagesDiffer = Boolean(contentLang && postingLang && contentLang !== postingLang);

  /*
    `B-118`, `F-039`: a thin profile may produce a CV shorter than it was
    allowed to be, and that is correct output rather than a fault. It is said
    once, quietly, because a reader who sees one page where two were allowed
    otherwise wonders what went missing — and because the alternative people
    reach for is padding, which would be inventing work nobody did.

    **`maxPages` is the limit this document was built to**, not the profile's
    setting of today: a CV made under a one-page limit must not be called
    short because the preference has since been raised. The server sends it
    for exactly that reason, and sends nothing at all for a generation written
    before the limit was recorded — so an absent one draws no note rather than
    a guessed one.

    Not a warning and not a prompt: nothing offers to make it longer.
  */
  const shorterThanAllowed =
    data.pageCount !== undefined && data.maxPages !== undefined && data.pageCount < data.maxPages;

  return (
    <div className="flex flex-col gap-4">
      <p>
        {t('ready')}
        {data.pageCount !== undefined ? ` ${t('pages', { count: data.pageCount })}` : ''}
      </p>

      {shorterThanAllowed && (
        <p data-testid="length-note" className="text-muted-foreground text-sm">
          {t('lengthNote', { pages: data.pageCount!, limit: data.maxPages! })}
        </p>
      )}

      {languagesDiffer && (
        <p data-testid="language-note" className="text-muted-foreground text-sm">
          {t('languageNote', {
            content: languageName(data.contentLanguage, locale) ?? data.contentLanguage!,
            posting: languageName(data.postingLanguage, locale) ?? data.postingLanguage!,
          })}
        </p>
      )}

      {download.error && <ErrorPanel error={download.error} />}

      <div className="flex flex-wrap items-center gap-3">
        {/*
          Four formats, one endpoint (`B-094`, `B-105`). Every button goes out
          of service while any of them is fetching — they are the same request
          to the same document — but only the one that was pressed says so,
          because a second button announcing "preparing" is a claim about work
          nobody asked for.

          The order is what people want, not what the endpoint lists. PDF is
          the product; Word is what some ATS ask for; HTML is for pasting into
          a form; the source is for the one reader in a hundred who wants to
          see the LaTeX, and it sits last and quietest for that reason.
        */}
        <Button type="button" onClick={() => save('pdf')} disabled={download.isPending}>
          {pending === 'pdf' ? t('downloading') : t('download')}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => save('docx')}
          disabled={download.isPending}
        >
          {pending === 'docx' ? t('downloading') : t('downloadDocx')}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => save('html')}
          disabled={download.isPending}
        >
          {pending === 'html' ? t('downloading') : t('downloadHtml')}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => save('source')}
          disabled={download.isPending}
        >
          {pending === 'source' ? t('downloading') : t('downloadSource')}
        </Button>

        <Link href="/generate" className="text-sm underline underline-offset-4">
          {t('again')}
        </Link>
      </div>

      {/*
        § 22.6, and the backend asked for both halves by name. The page limit
        is exact in the PDF, **approximate** in Word — the atoms are the ones
        that fitted a typeset page and Word sets them in whatever room its own
        fonts take — and in HTML it does not apply **at all**, because there
        is no page to exceed.

        The two are said separately rather than folded into "the limit is only
        for the PDF". "Roughly one page" and "there is no such thing as a
        page here" are different promises, and a reader who pastes the HTML
        into a form needs the second one rather than the first.

        Nothing claims a page count for any of the three, here or on the wire,
        so this sentence is the only place the difference is stated.
      */}
      <p className="text-muted-foreground text-sm">{t('formatNote')}</p>

      {/*
        `B-102`. Beside the downloads because that is where somebody decides
        this is the resume that mattered, and read back on the history screen
        — a mark set in one place and read in another is a feature with one
        end; the item says the history is where it is read.

        `archived` is optional on the wire and absent means not archived: a
        generation is not made archived. `=== true` rather than truthiness so
        the switch is off while the field is missing rather than undefined,
        which React would treat as uncontrolled.
      */}
      <ArchiveToggle generationId={generationId} archived={data.archived === true} />

      {data.fitReport ? (
        <FitReport report={data.fitReport} />
      ) : (
        <p className="text-muted-foreground text-sm">{t('generalNote')}</p>
      )}

      {/*
        Faz G, both halves (`B-088`, `B-089`, `B-097`). A generation that has
        already been edited is retired, and editing it again is a `409` — so
        both boxes are replaced by the sentence that says why, rather than
        left on screen to be pressed into an error.

        The note links to the resume that replaced this one now
        (`supersededByGenerationId`, `B-097`); before, the wire carried no
        pointer from a retired generation to its successor and the history
        does not list one, so the screen could say a newer one existed and not
        say where. What it still says is that this one downloads, which is the
        promise that matters — a CV already sent to an employer does not stop
        existing because a newer one was made.
      */}
      {data.status === 'superseded' ? (
        <div className="flex flex-col gap-2">
          <p data-testid="superseded-note" className="text-muted-foreground text-sm">
            {t('supersededNote')}
          </p>
          {data.supersededByGenerationId && (
            <Link
              data-testid="superseded-link"
              href={`/generations/${data.supersededByGenerationId}`}
              className="w-fit text-sm underline underline-offset-4"
            >
              {t('supersededLink')}
            </Link>
          )}
        </div>
      ) : (
        <>
          <EditRequest generationId={generationId} />
          {/*
            The hand toggle, under the sentence box rather than beside it:
            they do the same thing — an edit to the selection state — and the
            difference the reader has to weigh is what each costs. Closed
            until asked for, because the list is a second request and most
            readers never open it.
          */}
          <SelectionEditor generationId={generationId} />
        </>
      )}

      {/*
        Always drawn for an account, letter or not. `coverLetter: true` at
        generation time is allowed to produce a resume with no letter — a
        letter that could not be written does not fail the job (`B-056`) — so
        the absence is a state the reader can act on rather than an error to
        report.

        Without an account there is neither a letter nor a way to ask for one
        (§ 35.7.3): `POST /generations` refuses the box and this endpoint
        refuses the request behind the button. The panel is replaced by the
        sentence that says so, rather than left on screen to be pressed into a
        `403`.
      */}
      {canWriteCoverLetter ? (
        <CoverLetter generationId={generationId} letter={data.coverLetter} />
      ) : (
        anonymous === true && (
          <p
            data-testid="cover-letter-account"
            className="border-border text-muted-foreground rounded-md border p-4 text-sm"
          >
            {t('coverLetterAccount')}
          </p>
        )
      )}

      {/*
        Last, and after the letter: the verdict is about what the reader has
        by then actually looked at.

        An anonymous caller has no verdict to show and none to give — `B-082`
        is explicit that `feedback` comes back null there, because both the
        verdict and the 48-hour diagnostic grant belong to an account that can
        still be reached when somebody reads them. An empty form would post
        into a refusal.
      */}
      {anonymous === false && <Feedback generationId={generationId} recorded={data.feedback} />}
    </div>
  );
}
