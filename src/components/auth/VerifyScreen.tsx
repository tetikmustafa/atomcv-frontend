'use client';

/**
 * Where the link in the email lands — and the one screen in the product that
 * exists because of a machine rather than a person.
 *
 * **This page must not sign anyone in by being opened.** Corporate mail
 * scanners click links on their own, and a single-use token spent by a
 * scanner leaves the person who was actually sent it unable to get in at all
 * (§ 40.3). So the link is a `GET` that shows a button, and the button is the
 * `POST`.
 *
 * **The button also cannot be pressed first.** `POST /auth/verify` is a write
 * and carries the CSRF token from the `XSRF-TOKEN` cookie (`B-044`) — which a
 * browser arriving from an inbox has never been given. Reading the session
 * first is what plants it; without that, every magic-link sign-in is a `403`
 * (`B-049`). That read is the reason the button waits, and the reason the
 * wait is not just politeness.
 *
 * Nothing here asks why a link failed. Expired, already used, wrong verifier
 * and never existed are one answer on purpose: told apart, they tell somebody
 * guessing which half of the guess was right (§ 40.4.1).
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SignInOutcome } from '@/components/auth/SignInOutcome';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { useSession, useVerifyMagicLink } from '@/hooks/useSession';
import {
  describableUpgrade,
  upgradeDestination,
  type DescribedUpgrade,
} from '@/lib/auth/profileUpgrade';
import { Link, useRouter } from '@/lib/i18n/navigation';

/**
 * Where a redeemed link leads by default.
 *
 * Not `safeReturnPath`'s `/`, and not a `next` either: the link was composed
 * on a server that knew nothing about the browser it would eventually be
 * opened in. Somebody who just signed in has no use for the marketing page,
 * so this names the product's own front door.
 *
 * `upgradeDestination` overrides it for the one outcome that now has
 * somewhere better to go (`B-084`).
 */
const DESTINATION = '/profile';

export type VerifyScreenProps = {
  selector?: string;
  verifier?: string;
};

export function VerifyScreen({ selector, verifier }: VerifyScreenProps) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const session = useSession();
  const verify = useVerifyMagicLink();

  /**
   * Held here rather than read back off the mutation, and that is not
   * belt-and-braces: `useVerifyMagicLink` clears the whole query client on
   * success, and `clear()` empties the mutation cache too. Copying the one
   * fact out first makes the screen independent of whether an observer's
   * result happens to survive that.
   */
  const [outcome, setOutcome] = useState<{ upgrade: DescribedUpgrade | null }>();

  /*
    `upgraded` carries the anonymous generations across as well as the profile
    (`B-084`), so that reader is sent to the list rather than to the editor —
    there is something in it now, which is the whole reason the redirect was
    wrong before. Every other outcome keeps the front door.
  */
  const destination = upgradeDestination(outcome?.upgrade ?? null, DESTINATION);

  useEffect(() => {
    // Only once it is in, and only when there is nothing to say.
    if (!outcome || outcome.upgrade) return;

    router.replace(destination);
  }, [outcome, destination, router]);

  if (!selector || !verifier) {
    return (
      <Frame title={t('verifyTitle')}>
        {/*
          Half a link is not a failed sign-in, so it gets no error code: this
          is a URL that never carried what it needed, usually because a mail
          client wrapped it and something got lost on the way.
        */}
        <p role="alert" className="text-sm">
          {t('verifyMissing')}
        </p>
        <BackToSignIn label={t('backToSignIn')} />
      </Frame>
    );
  }

  if (outcome?.upgrade) {
    return (
      <Frame title={t('verifyTitle')}>
        <SignInOutcome outcome={outcome.upgrade} destination={destination} />
      </Frame>
    );
  }

  if (outcome) {
    return (
      <Frame title={t('verifyTitle')}>
        <p role="status" aria-live="polite" className="text-muted-foreground text-sm">
          {t('completing')}
        </p>
      </Frame>
    );
  }

  return (
    <Frame title={t('verifyTitle')}>
      <p className="text-muted-foreground text-sm">{t('verifyBody')}</p>

      {/* The pre-`GET` failed, so the write would be refused for a reason
          that has nothing to do with the link. Retrying the read is the fix. */}
      {session.isError && (
        <ErrorPanel error={session.error} onRetry={() => void session.refetch()} />
      )}

      {verify.error && <ErrorPanel error={verify.error} />}

      {verify.error ? (
        /*
          No second press, and this is not a branch on which error came back.
          The token is single-use: whatever the server said, sending the same
          pair again cannot succeed, so the only honest control left is the
          way to ask for a new link.
        */
        <BackToSignIn label={t('backToSignIn')} />
      ) : (
        <Button
          type="button"
          className="w-fit"
          // Until the session read has landed there is no CSRF cookie, and
          // this would be a guaranteed 403.
          disabled={session.isPending || verify.isPending}
          onClick={() =>
            verify.mutate(
              { selector, verifier },
              {
                onSuccess: (response) =>
                  setOutcome({ upgrade: describableUpgrade(response?.profileUpgrade) }),
              },
            )
          }
        >
          {verify.isPending ? t('completing') : t('verifyAction')}
        </Button>
      )}
    </Frame>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-8 py-16">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

function BackToSignIn({ label }: { label: string }) {
  return (
    <Link href="/login" className="text-sm underline underline-offset-4">
      {label}
    </Link>
  );
}
