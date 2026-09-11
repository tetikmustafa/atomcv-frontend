'use client';

/**
 * Turning the optional emails off, from an inbox (§ 57.7, § 40.3, `B-096`).
 *
 * **The link lands on a page, not on the endpoint, and that is the whole
 * design.** Corporate mail gateways fetch every address in a message before
 * anybody reads it; a link that unsubscribed when it was *fetched* would cut
 * off people who never clicked. So the mail carries a page, the page carries
 * a button, and the button is what does the work.
 *
 * **No session.** It is pressed from an inbox where there may be no cookie.
 * CSRF still applies in the ordinary way — the page is on our origin and can
 * read the token to double-submit it.
 *
 * **An unknown token answers `204` too, deliberately.** A different answer
 * would be an oracle for which tokens are live, so there is no "invalid link"
 * screen to write: this says the same thing either way, and it is not a lie —
 * whatever that token stood for is not receiving optional mail.
 */

import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { useUnsubscribe } from '@/hooks/useSession';
import { Link } from '@/lib/i18n/navigation';

export function UnsubscribeScreen({ token }: { token: string | undefined }) {
  const t = useTranslations('Unsubscribe');
  const unsubscribe = useUnsubscribe();

  // No token in the address at all. That is not a token the server refused —
  // it is a link that arrived broken, and there is nothing to send.
  if (!token) {
    return <p className="text-sm">{t('noToken')}</p>;
  }

  if (unsubscribe.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm">
          {t('done')}
        </p>
        <p className="text-muted-foreground text-sm">
          {t.rich('doneSettings', {
            link: (chunks) => (
              <Link href="/settings" className="underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{t('intro')}</p>
      <p className="text-muted-foreground text-sm">{t('keeps')}</p>

      {unsubscribe.error && <ErrorPanel error={unsubscribe.error} />}

      <Button
        type="button"
        className="w-fit"
        disabled={unsubscribe.isPending}
        onClick={() => unsubscribe.mutate(token)}
      >
        {unsubscribe.isPending ? t('working') : t('confirm')}
      </Button>
    </div>
  );
}
