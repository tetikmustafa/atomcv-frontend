'use client';

/**
 * Where a sign-in that did not finish lands (`B-048`).
 *
 * A redirect, not a response, so there is no problem body and no
 * `resolutions` — the server put the code in the URL instead. The sentence
 * still comes from the catalogue through the one resolver: `OAUTH_FAILED` is
 * a single code with seven reasons behind an ICU `select` (`B-043`'s shape),
 * so nothing here branches on what went wrong.
 *
 * With one exception, and it is the point of the file. **`declined` is not a
 * failure** — it is somebody pressing "cancel" on a consent screen, which is
 * an answer the product asked for. Rule 7 forbids a UI that switches on the
 * error *code*; it does not require dressing a deliberate choice up as a
 * fault, and a red panel with `role="alert"` would tell the reader something
 * broke when nothing did.
 */

import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { Link } from '@/lib/i18n/navigation';

/** What lands here when the URL carries no code of its own. */
const DEFAULT_CODE = 'OAUTH_FAILED';

/** The one reason that is a decision rather than a fault (`B-048`). */
const DECLINED = 'declined';

export type AuthErrorNoticeProps = {
  code?: string;
  reason?: string;
};

export function AuthErrorNotice({ code, reason }: AuthErrorNoticeProps) {
  const t = useTranslations('Auth');
  const describe = useErrorMessage();

  // Straight through, unvalidated on purpose: `useErrorMessage` already falls
  // back for a code it cannot name, and an unknown `reason` lands on the ICU
  // `other` branch. Filtering here would be a second, worse copy of both.
  const error = { code: code || DEFAULT_CODE, params: reason ? { reason } : {} };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-8 py-16">
      <h1 className="text-xl font-semibold">{t('errorTitle')}</h1>

      {reason === DECLINED ? (
        <p role="status" className="text-sm">
          {describe(error)}
        </p>
      ) : (
        <ErrorPanel error={error} />
      )}

      <Link href="/login" className="text-sm underline underline-offset-4">
        {t('backToSignIn')}
      </Link>
    </div>
  );
}
