'use client';

/**
 * Ask for a sign-in link.
 *
 * **The answer is the same whether or not the address has an account.** That
 * is not a simplification — § 40.4 makes it the requirement: a screen that
 * said "we've sent it" only for addresses it knows would publish the account
 * list one probe at a time. The server answers `202` with no body precisely
 * so the sentence is the client's to write, and the sentence is written once.
 *
 * The form does not survive its own success. What replaces it says what
 * happens next and how long the reader has; a form still sitting there
 * invites a second request, and each one spends a slot out of three.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestMagicLink } from '@/hooks/useSession';

/**
 * Deliberately looser than any real rule, and it exists for one of the two
 * reasons `profileSchemas.ts` allows a client-side check at all: **a round
 * trip that would be wasted**. The address layer of § 40.5 allows three
 * requests per fifteen minutes, so a typo spends a twentieth of an hour of
 * the reader's own allowance and sends mail nowhere.
 *
 * The server remains the authority on what an address is. This only catches
 * what is obviously not one.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MagicLinkForm() {
  const t = useTranslations('Auth');
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string>();
  /**
   * Bumping this remounts the widget, which is how it is reset.
   *
   * On **every** refusal, not only `CHALLENGE_FAILED`. A Turnstile token is
   * single-use, and the server does not publish which of the three limiter
   * layers turned a request away (`B-050`) — so there is no way to tell a
   * refusal that spent the token from one that did not. A fresh token always
   * works; a discarded good one costs a second.
   */
  const [attempt, setAttempt] = useState(0);

  const request = useRequestMagicLink();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim();

    if (!LOOKS_LIKE_EMAIL.test(address)) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    request.mutate(
      // Omitted rather than sent empty when there is no challenge: a
      // deployment without a Turnstile secret has it switched off, and an
      // empty string is a *value* the server would have to refuse.
      { email: address, ...(challengeToken ? { challengeToken } : {}) },
      {
        onError: () => {
          setChallengeToken(undefined);
          setAttempt((n) => n + 1);
        },
      },
    );
  }

  if (request.isSuccess) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" aria-live="polite" className="text-sm">
          {t('linkSent')}
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-start px-0"
          onClick={() => {
            request.reset();
            setEmail('');
          }}
        >
          {t('differentAddress')}
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="magic-link-email">{t('emailLabel')}</Label>
        <Input
          id="magic-link-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'magic-link-email-error' : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            // Cleared on the next keystroke rather than on the next submit:
            // the message is about the value that was there, and it stops
            // being about the value the moment it changes.
            if (invalid) setInvalid(false);
          }}
        />
        {invalid && (
          <p id="magic-link-email-error" role="alert" className="text-destructive text-sm">
            {t('emailInvalid')}
          </p>
        )}
      </div>

      <TurnstileWidget key={attempt} onToken={setChallengeToken} />

      {request.error && <ErrorPanel error={request.error} />}

      {/*
        Never disabled by the challenge. Turnstile normally resolves before
        anyone can reach the button, and a primary action greyed out by a
        widget the reader cannot see the state of is worse than the one
        refusal this screen already knows how to explain and recover from.
      */}
      <Button type="submit" disabled={request.isPending} className="w-fit">
        {request.isPending ? t('sending') : t('sendLink')}
      </Button>
    </form>
  );
}
