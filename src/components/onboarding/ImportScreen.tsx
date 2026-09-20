'use client';

/**
 * How a profile usually starts: upload the CV you already have (`B-051`).
 *
 * **One code path, account or not** (`B-053`). § 31.6.3 is explicit that
 * anonymous import is the same endpoint and the same pattern; what differs is
 * where the server writes and which allowance it counts, and the screen has
 * no business knowing either. The one place the difference surfaces is the
 * quota refusal, and the catalogue carries that.
 *
 * **The file picker filters on nothing.** `accept` is tempting and wrong: the
 * accepted list has a single owner and the server publishes it in the `415`
 * (`B-051`), so a format added server-side has to start working without a
 * frontend release. A picker that hid `.md` the day the server started
 * reading it would be a client quietly overruling the API.
 */

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { ProgressBar } from '@/components/feedback/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useJobStream } from '@/hooks/useJob';
import { useImportCv, useProfileReplaced } from '@/hooks/useProfileImport';
import { useCapabilities, useIsAnonymous } from '@/hooks/useSession';
import { toErrorLike } from '@/lib/errors/errorLike';
import { languageName } from '@/lib/i18n/languageNames';
import { useRouter } from '@/lib/i18n/navigation';
import { announce } from '@/stores/announcerStore';
import { useEffect } from 'react';
import type { Resolution } from '@/types/domain';

/**
 * What this screen can actually do about each way out the server offers.
 *
 * `replace_profile` and `keep_existing_profile` are the two `409` answers and
 * there is no third: merging means atom-level deduplication, which is Stage 4
 * work, so offering it would name an action nothing can perform (`B-060`).
 */
const HANDLED = [
  'replace_profile',
  'keep_existing_profile',
  'retry',
  'switch_to_manual_form',
  'upload_another_file',
  'choose_language',
] as const;

/**
 * **`choose_language` joined that list when the field did** (`B-119`,
 * `F-037`).
 *
 * It was dropped for a year of items because the answer had nowhere to
 * travel: `POST /profile/import` published `mode` and nothing else, so the
 * button would have reopened the same refusal. The multipart body now carries
 * `language`, and a declared language **skips detection** rather than
 * weighting it — which is what makes the second attempt a different question
 * instead of the same one.
 *
 * What is still true is the rule that kept it out: a resolution this screen
 * cannot carry out is dropped rather than drawn. `keep_top_pinned` is still
 * dropped, and for the reason this one no longer is.
 */
function canResolve(action: Resolution['action']) {
  return (HANDLED as readonly string[]).includes(action);
}

/**
 * The server's guesses, off the refusal that offered the button.
 *
 * `detectedCandidates` belongs to the **error**, not to the resolution — the
 * resolution carries an action and nothing else — so the panel's `onResolve`
 * is not where this can be read from, and the failure travels beside it.
 *
 * At most one comes back, which is what makes the question askable at all:
 * "this one, or another language?" rather than a menu of near-misses.
 */
function candidatesOf(failure: unknown): string[] {
  const value = toErrorLike(failure).params?.detectedCandidates;
  return Array.isArray(value)
    ? value.filter((code): code is string => typeof code === 'string')
    : [];
}

export function ImportScreen() {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<{ jobId: string; streamUrl?: string } | null>(null);

  /**
   * The challenge (§ 35.7.4, `B-083`), reset by remounting the widget.
   *
   * Reset after **every** attempt rather than only on refusal: the token is
   * single-use, and the second request this screen makes most often is the
   * `replace_profile` answer to a `409` — the same file, one question later,
   * with the first token already spent.
   */
  const [challengeToken, setChallengeToken] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  /**
   * The `choose_language` answer, and the fact that it is being asked for
   * (`B-119`).
   *
   * One piece of state rather than two: the chooser exists *because* an
   * answer is owed, and a selected language with no question behind it would
   * be a declaration nobody made. It is cleared whenever the file changes —
   * a language declared about one CV says nothing about the next.
   */
  const [declaring, setDeclaring] = useState<{ offered: string[]; language: string } | null>(null);

  const anonymous = useIsAnonymous();
  const capabilities = useCapabilities();
  const locale = useLocale();

  const start = useImportCv();

  function spendChallenge() {
    setChallengeToken(undefined);
    setAttempt((n) => n + 1);
  }

  /**
   * What the chooser may offer: the server's guess, then the languages a
   * profile of this caller's may be written in.
   *
   * **Both halves are the server's** — `detectedCandidates` off the refusal
   * and `capabilities.allowedLanguages` off the session — and neither is a
   * constant here. An anonymous session is English-only (§ 9), so a hardcoded
   * list would offer a language the profile could not then hold; the guess
   * goes first because it is the answer the reader is most likely to confirm.
   *
   * The guess is kept even where it is outside `allowedLanguages`: the server
   * read that language out of the file, and dropping it would leave the
   * reader confirming something they can see is wrong.
   */
  function openChooser(candidates: string[]) {
    const allowed = capabilities?.allowedLanguages ?? [];
    const offered = [...candidates, ...allowed.filter((code) => !candidates.includes(code))];
    const first = offered[0];

    return first === undefined ? null : { offered, language: first };
  }

  function submit(replace = false) {
    if (!file) return;

    start.mutate(
      {
        file,
        ...(replace ? { replace } : {}),
        // Absent rather than empty where there is none: the server reads an
        // empty value as a failed challenge, and a deployment without a
        // secret lets an absent one through (`B-083`).
        ...(challengeToken ? { challengeToken } : {}),
        // Only ever what the reader chose after the server asked (`B-119`).
        // Absent is the ordinary upload, where detection does its job.
        ...(declaring ? { language: declaring.language } : {}),
      },
      {
        onSuccess: (accepted) => {
          spendChallenge();
          if (!accepted.jobId) return;
          setJob({
            jobId: accepted.jobId,
            ...(accepted.streamUrl ? { streamUrl: accepted.streamUrl } : {}),
          });
        },
        onError: spendChallenge,
      },
    );
  }

  function resolve(resolution: Resolution, failure?: unknown) {
    switch (resolution.action) {
      case 'choose_language': {
        /*
          `B-119`. The refusal came out of the worker, so there is nothing
          half-written to answer on: the answer rides the **next** upload, and
          that upload is the same file one question later.

          Back to the form rather than a control on the progress view: the
          file picker, the challenge and the upload button all live there, and
          the reader is about to use all three. The file is deliberately kept.
        */
        const chooser = openChooser(candidatesOf(failure));

        // Nothing to offer means no question to ask, and the panel that is
        // already on screen is more use than an empty select. Unreachable
        // while the refusal carries its candidates, which is every time the
        // server offers this action.
        if (!chooser) return;

        setJob(null);
        start.reset();
        setDeclaring(chooser);
        // The panel that asked the question is unmounted by this, and the
        // control that answers it is a screen away from where the focus is.
        // Said politely: nothing went wrong, a question was asked.
        announce(t('languageHint'), 'polite');
        return;
      }

      case 'replace_profile':
        // The same request, one question later — `?mode=replace` is consent,
        // and it is only ever sent because the server offered this button.
        return submit(true);

      case 'keep_existing_profile':
        // Nothing is sent. The profile stays as it is, and the reader goes
        // back to it rather than being left on an upload form they have just
        // decided against.
        start.reset();
        return router.push('/profile');

      case 'retry':
        return submit();

      case 'switch_to_manual_form':
        // Nothing came out of the file, so the way forward is to write it.
        return router.push('/profile');

      case 'upload_another_file':
        /*
          **Not `retry`, and the difference is the whole of `B-114`.** This
          arrives with `PDF_ENCRYPTED`, and an encrypted file fails in the
          same place every single time — a retry button would offer a door
          that is known to be locked. What the reader needs is the picker,
          because the copy they can open may already be on their machine.

          The current file is cleared first. Leaving it selected would let
          somebody close the picker and press Upload on the very file that was
          just refused, which is the retry this is written to avoid.

          `setJob(null)` covers the view this cannot arrive on today —
          `PDF_ENCRYPTED` is refused synchronously, so the panel is on the
          form. If it ever came from a job, the progress view has no `<input>`
          mounted and the click would land on nothing; going back to the form
          leaves an empty picker to press instead of a dead button.
        */
        setFile(null);
        setJob(null);
        start.reset();
        // A different file is a different document: whatever was declared
        // about the refused one says nothing about the next (`B-119`).
        setDeclaring(null);
        if (input.current) {
          input.current.value = '';
          input.current.click();
        }
        return;

      default:
        // Unreachable: `canResolve` decides what is drawn.
        return;
    }
  }

  /**
   * Drawn on both views, and only for a caller without an account.
   *
   * Two of the ways out of a failed extraction — `retry` and, after a `409`,
   * `replace_profile` — send the file again from the progress view, and each
   * is a fresh upload that has to carry a fresh token. A widget that
   * unmounted with the form would answer both with `403 CHALLENGE_FAILED`.
   *
   * Nothing is drawn where no site key is configured, which is the local
   * deployment and both test environments (`B-050`).
   */
  const challenge = anonymous === true && (
    <TurnstileWidget key={attempt} onToken={setChallengeToken} />
  );

  if (job) {
    return (
      <div className="flex flex-col gap-4">
        <ImportProgress
          jobId={job.jobId}
          {...(job.streamUrl ? { streamUrl: job.streamUrl } : {})}
          onResolve={resolve}
          onStartOver={() => {
            setJob(null);
            setFile(null);
            start.reset();
            setDeclaring(null);
          }}
        />
        {challenge}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="cv-file">{t('fileLabel')}</Label>
        <input
          ref={input}
          id="cv-file"
          name="file"
          type="file"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            // The declaration was about the file being replaced (`B-119`).
            setDeclaring(null);
          }}
          className="file:border-border file:bg-background text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="text-muted-foreground text-sm">{t('fileHint')}</p>
      </div>

      {/*
        The `choose_language` answer, asked for only because the server
        offered the action (`B-119`, `F-037`).

        A select rather than free text: the server refuses a code it does not
        know with `400 VALIDATION_FAILED`, and the reader typing `tr-TR` into
        a box would meet that refusal without ever being told what a valid
        answer looks like. The names come from `Intl.DisplayNames` in the
        interface language — this is a question about the document, asked of
        the person, so it is the one place the two axes meet (rule 9).
      */}
      {declaring && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="cv-language">{t('languageLabel')}</Label>
          <p id="cv-language-hint" className="text-muted-foreground text-sm">
            {t('languageHint')}
          </p>
          <select
            id="cv-language"
            name="language"
            value={declaring.language}
            aria-describedby="cv-language-hint"
            onChange={(event) =>
              setDeclaring((current) =>
                current === null ? current : { ...current, language: event.target.value },
              )
            }
            className="border-border bg-background w-fit rounded-md border px-3 py-1.5 text-sm"
          >
            {declaring.offered.map((code) => (
              <option key={code} value={code}>
                {languageName(code, locale) ?? code}
              </option>
            ))}
          </select>
        </div>
      )}

      {challenge}

      {start.error && (
        <ErrorPanel
          error={start.error}
          onResolve={(resolution) => resolve(resolution, start.error)}
          canResolve={canResolve}
        />
      )}

      <Button type="submit" disabled={!file || start.isPending} className="w-fit">
        {start.isPending ? t('uploading') : t('upload')}
      </Button>
    </form>
  );
}

/**
 * The job, from the 202 to whichever way it ends.
 *
 * Separate from the generation's progress screen rather than shared with it:
 * the two agree on a bar and on nothing else. This one has no phase names to
 * render — the import job publishes no `label` keys — so the caption is this
 * screen's own sentence about what it is doing, which is not rule 8's
 * territory: rule 8 governs text the *server* owns.
 */
function ImportProgress({
  jobId,
  streamUrl,
  onResolve,
  onStartOver,
}: {
  jobId: string;
  streamUrl?: string;
  /**
   * The failure travels with the resolution: `detectedCandidates` is on the
   * error rather than on the action, and `choose_language` needs it (`B-119`).
   */
  onResolve: (resolution: Resolution, failure?: unknown) => void;
  onStartOver: () => void;
}) {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const progress = useJobStream(jobId, streamUrl);
  const profileReplaced = useProfileReplaced();

  const spoken = useRef<string | null>(null);

  useEffect(() => {
    const sentence =
      progress.status === 'completed'
        ? t('announceDone')
        : progress.status === 'failed'
          ? t('announceFailed')
          : t('announceProgress', { pct: progress.pct });

    // On change rather than on render: a live region that repeats itself is
    // one people turn off.
    if (spoken.current === sentence) return;
    spoken.current = sentence;
    announce(sentence, progress.status === 'failed' ? 'assertive' : 'polite');
  }, [t, progress.status, progress.pct]);

  useEffect(() => {
    if (progress.status !== 'completed') return;

    // Everything cached about the profile describes the one that was there
    // before this ran. Dropped *here* rather than at the 202: the rows are
    // written by the worker, so a cache emptied on acceptance would refill
    // from the old profile seconds before the new one existed.
    profileReplaced();

    // `push`, not `replace`: the review is a step of its own and Back should
    // reach the upload form. The job id travels because the review has one
    // thing to say that only the terminal event knows (`F-018`).
    router.push(`/onboarding/review?job=${encodeURIComponent(jobId)}`);
  }, [router, jobId, progress.status, profileReplaced]);

  if (progress.status === 'failed') {
    return (
      <div className="flex flex-col gap-4">
        {/*
          Three of these are the server's and one of them is repeatable:
          `ALL_PROVIDERS_UNAVAILABLE` is the only refusal here worth trying
          again, and it says so by carrying `retry` (`B-051`). Nothing is
          invented — the panel draws what arrived.
        */}
        <ErrorPanel
          error={progress.failure}
          onResolve={(resolution) => onResolve(resolution, progress.failure)}
          canResolve={canResolve}
        />
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onStartOver}>
          {t('chooseAnother')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ProgressBar pct={progress.pct} label={t('progressLabel')} valueText={t('reading')} />
      <p className="text-muted-foreground text-sm">{t('reading')}</p>
    </div>
  );
}
