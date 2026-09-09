'use client';

/**
 * Where a successful OAuth sign-in lands, and why it is not the destination.
 *
 * The session cookie is `SameSite=Strict` (§ 40.1), and a browser does not
 * send a Strict cookie on a request whose redirect chain started somewhere
 * else — this chain started at Google. Redirecting straight to `/profile`
 * would render the first screen **signed out**, and only a manual reload
 * would fix it: a bug that reads as flaky authentication. So the callback
 * lands here, this page asks `/auth/session` with a same-origin `fetch`
 * (which does carry the cookie), and only then moves on (§ 40.6.1).
 *
 * That the query then sits in the cache is a second, smaller win: the screen
 * it hands over to does not re-ask.
 *
 * The UI language survives the same trip for the opposite reason. next-intl's
 * `NEXT_LOCALE` is `SameSite=Lax`, and Lax cookies *are* sent on a top-level
 * navigation, so the locale-less `/auth/complete` the server redirects to is
 * routed to the language the reader was already using.
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { SignInOutcome } from '@/components/auth/SignInOutcome';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { useSession } from '@/hooks/useSession';
import { describableUpgrade, upgradeDestination } from '@/lib/auth/profileUpgrade';
import { safeReturnPath } from '@/lib/auth/returnPath';
import { Link, useRouter } from '@/lib/i18n/navigation';

export type SignInLandingProps = {
  /** The raw `next` off the URL. Validated here, not trusted. */
  next?: string;
  /** The raw `profile` off the URL — § 41.3.3's four-valued outcome. */
  profile?: string;
};

export function SignInLanding({ next, profile }: SignInLandingProps) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { data: session, isPending, isError, error, refetch } = useSession();

  const requested = safeReturnPath(next);
  const outcome = describableUpgrade(profile);

  /*
    `B-084`: an `upgraded` sign-in now carries the anonymous **generations**
    across as well as the profile, so the list is worth landing on — it was
    not before, when it would have been an empty page.

    Only where nothing else was asked for. A `next` that survived
    `safeReturnPath` is the screen the reader was sent away from, and
    finishing that beats a list the navigation already reaches; a `next` that
    did not survive is indistinguishable here from none at all, and both mean
    the same thing — nowhere in particular.
  */
  const destination = requested === '/' ? upgradeDestination(outcome, requested) : requested;
  const signedIn = session?.authenticated === true;

  useEffect(() => {
    // Only once the answer is in, and only when there is nothing to say. The
    // three outcomes that do have something to say stop here on purpose: a
    // sentence shown for the length of a redirect is a sentence nobody reads,
    // and one of them is the only notice that two hours of work did not
    // survive.
    if (!signedIn || outcome) return;

    router.replace(destination);
  }, [signedIn, outcome, destination, router]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-8 py-16">
      {(isPending || (signedIn && !outcome)) && (
        <p role="status" aria-live="polite" className="text-muted-foreground text-sm">
          {t('completing')}
        </p>
      )}

      {isError && (
        <>
          <ErrorPanel error={error} onRetry={() => void refetch()} />
          <Link href="/login" className="text-sm underline underline-offset-4">
            {t('backToSignIn')}
          </Link>
        </>
      )}

      {/*
        The cookie did not stick — the one failure this page exists to catch.
        Sending them on to the app anyway would hand an anonymous session to
        somebody who just finished signing in, and every screen after it would
        be a slightly wrong screen with no explanation. No error code is
        invented for it: the server said nothing went wrong, so this is the
        client's own sentence.
      */}
      {!isPending && !isError && !signedIn && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-sm">
            {t('notSignedIn')}
          </p>
          <Link href="/login" className="text-sm underline underline-offset-4">
            {t('backToSignIn')}
          </Link>
        </div>
      )}

      {signedIn && outcome && <SignInOutcome outcome={outcome} destination={destination} />}
    </div>
  );
}
