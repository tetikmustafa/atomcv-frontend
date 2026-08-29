'use client';

/**
 * Paste a posting, get a resume.
 *
 * The form is one field on purpose. "Manual control is optional" is a product
 * rule, not a simplification: the default output has to be usable without the
 * user touching anything, so the page budget and the wording language stay
 * where the profile already decided them. `maxPages` reaches the request only
 * when the *server* offers `increase_page_limit` as a way out of an error.
 *
 * The posting itself is optional too. Its absence is general mode (§ 35.3) —
 * narrower in aim, never lower in quality — so the button is never disabled
 * for an empty field.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { JobProgress } from '@/components/generation/JobProgress';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useStartGeneration } from '@/hooks/useGeneration';
import { useRouter } from '@/lib/i18n/navigation';
import type { GenerationRequest } from '@/lib/api/endpoints/generations';
import type { Resolution } from '@/types/domain';

/**
 * What this screen can actually do about each way out the server offers.
 *
 * Everything reachable from `POST /generations` and from a failed job is
 * here. The rest is dropped rather than drawn: `keep_top_pinned` needs a
 * request field the schema does not publish, and `switch_to_manual_form`
 * belongs to extraction. A button that does nothing is worse than one that
 * was never offered.
 *
 * `sign_up` used to be on that list and no longer is. It was dropped because
 * there was nowhere for it to go, which was true of the whole product until
 * this slice: `FEATURE_REQUIRES_ACCOUNT` is the server telling an anonymous
 * caller that the way forward is an account, and until now the client's
 * answer was to say nothing at all.
 */
const HANDLED = [
  'continue_anyway',
  'paste_full_posting',
  'continue_as_general_cv',
  'complete_profile',
  'review_pins',
  'increase_page_limit',
  'sign_up',
  'retry',
] as const;

function canResolve(action: Resolution['action']) {
  return (HANDLED as readonly string[]).includes(action);
}

export function GenerateScreen() {
  const t = useTranslations('Generation');
  const router = useRouter();

  const [posting, setPosting] = useState('');
  /**
   * Off, like the server's own default (`B-056`).
   *
   * A second LLM call, and most people want a resume — so it is offered
   * rather than assumed. "Manual control is optional" cuts the other way for
   * once: the default output is the CV alone, and this is the one control on
   * this screen that adds to it.
   */
  const [coverLetter, setCoverLetter] = useState(false);
  const [job, setJob] = useState<{ jobId: string; streamUrl?: string } | null>(null);

  const start = useStartGeneration();

  function submit(overrides: Partial<GenerationRequest> = {}) {
    const trimmed = posting.trim();

    const body: GenerationRequest = {
      acknowledgePreflight: false,
      // Always stated, never left to the default, for the reason the
      // endpoint's own comment gives about `acknowledgePreflight`: the
      // generator makes both required because the server defaults them, and a
      // body that states what it asked for is the one that cannot drift.
      coverLetter,
      ...(trimmed === '' ? {} : { jobDescription: trimmed }),
      ...overrides,
    };

    start.mutate(body, {
      onSuccess: (accepted) => {
        if (!accepted.jobId) return;
        setJob({
          jobId: accepted.jobId,
          ...(accepted.streamUrl ? { streamUrl: accepted.streamUrl } : {}),
        });
      },
    });
  }

  /**
   * One resolver for both transports. The same failure arrives as a
   * synchronous 4xx and as an SSE `failed` event, and two `switch (code)`
   * blocks is how the two paths drift until an error behaves differently
   * depending on when it happened.
   */
  function resolve(resolution: Resolution) {
    switch (resolution.action) {
      case 'continue_anyway':
        // Not a retry: the same text sent the same way is refused the same
        // way, which is a loop rather than a way out (`B-037`).
        return submit({ acknowledgePreflight: true });

      case 'continue_as_general_cv':
        setPosting('');
        // Blank rather than omitted, and the schema says both mean the same
        // thing. Omitting it would mean leaving it out of an object that
        // still holds the posting this render was built with — the state
        // update above lands on the next one.
        return submit({ jobDescription: '' });

      case 'paste_full_posting':
        start.reset();
        return document.getElementById('job-posting')?.focus();

      case 'increase_page_limit': {
        const maxPages = resolution.params?.maxPages;
        return submit(typeof maxPages === 'number' ? { maxPages } : {});
      }

      case 'retry':
        return submit();

      case 'complete_profile':
      case 'review_pins':
        // Both mean the same thing here: what has to change is in the
        // profile, and this screen cannot change it.
        return router.push('/profile');

      case 'sign_up':
        // `next` back to this screen. The pasted posting does not survive the
        // trip — nothing here persists it — but landing on the page they were
        // sent away from is the difference between one paste and a hunt
        // through the navigation for where they were.
        return router.push('/login?next=%2Fgenerate');

      default:
        // Unreachable: `canResolve` decides what is drawn, and the panel
        // never invents an action.
        return;
    }
  }

  if (job) {
    return (
      <JobProgress
        jobId={job.jobId}
        {...(job.streamUrl ? { streamUrl: job.streamUrl } : {})}
        onResolve={resolve}
        canResolve={canResolve}
        onStartOver={() => {
          setJob(null);
          start.reset();
        }}
      />
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
        <Label htmlFor="job-posting">{t('postingLabel')}</Label>
        <Textarea
          id="job-posting"
          name="jobDescription"
          rows={12}
          value={posting}
          placeholder={t('postingPlaceholder')}
          onChange={(event) => setPosting(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch id="cover-letter" checked={coverLetter} onCheckedChange={setCoverLetter} />
        <Label htmlFor="cover-letter" className="font-normal">
          {t('coverLetter')}
        </Label>
      </div>

      {start.error && (
        <ErrorPanel error={start.error} onResolve={resolve} canResolve={canResolve} />
      )}

      <Button type="submit" disabled={start.isPending} className="w-fit">
        {start.isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
