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
import { CoverLetter } from '@/components/generation/CoverLetter';
import { Feedback } from '@/components/generation/Feedback';
import { FitReport } from '@/components/generation/FitReport';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { languageName } from '@/lib/i18n/languageNames';
import { useDownloadGeneration, useGenerationResult } from '@/hooks/useGeneration';
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

  function save() {
    download.mutate(generationId, {
      onSuccess: ({ blob, filename }) => {
        // The browser owns the save dialog; this only hands it the bytes.
        // A plain link would have been simpler and would have turned a `410`
        // into a page of JSON instead of an error with a way out of it.
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = filename ?? `atomcv-${generationId}.pdf`;
        anchor.click();

        URL.revokeObjectURL(url);
        announce(t('announceDownloaded'));
      },
    });
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

  return (
    <div className="flex flex-col gap-4">
      <p>
        {t('ready')}
        {data.pageCount !== undefined ? ` ${t('pages', { count: data.pageCount })}` : ''}
      </p>

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
        <Button type="button" onClick={save} disabled={download.isPending}>
          {download.isPending ? t('downloading') : t('download')}
        </Button>

        <Link href="/generate" className="text-sm underline underline-offset-4">
          {t('again')}
        </Link>
      </div>

      {data.fitReport ? (
        <FitReport report={data.fitReport} />
      ) : (
        <p className="text-muted-foreground text-sm">{t('generalNote')}</p>
      )}

      {/*
        Always drawn, letter or not. `coverLetter: true` at generation time is
        allowed to produce a resume with no letter — a letter that could not
        be written does not fail the job (`B-056`) — so the absence is a state
        the reader can act on rather than an error to report.
      */}
      <CoverLetter generationId={generationId} letter={data.coverLetter} />

      {/*
        Last, and after the letter: the verdict is about what the reader has
        by then actually looked at.
      */}
      <Feedback generationId={generationId} recorded={data.feedback} />
    </div>
  );
}
