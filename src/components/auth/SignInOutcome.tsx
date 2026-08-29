'use client';

/**
 * What became of the anonymous profile, on the two screens that can say it
 * (§ 41.3.3, `B-054`).
 *
 * Shared because the fact is the same one arriving over two transports: the
 * magic link reads it out of a `200` body, OAuth out of the landing URL,
 * since a redirect has no body for a client to read. Two copies of these
 * three sentences would be two chances to word the bad news differently.
 *
 * It always stops for an answer rather than showing a line during a redirect.
 * One of the three is the only notice the reader gets that two hours of work
 * did not come with them, and a sentence displayed for the length of a
 * navigation is a sentence nobody reads.
 */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { DescribedUpgrade } from '@/lib/auth/profileUpgrade';
import { Link } from '@/lib/i18n/navigation';

export type SignInOutcomeProps = {
  outcome: DescribedUpgrade;
  /** Already validated by `safeReturnPath`, or a path this app owns. */
  destination: string;
};

export function SignInOutcome({ outcome, destination }: SignInOutcomeProps) {
  const t = useTranslations('Auth');

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm">
        {t(`upgrade.${outcome}`)}
      </p>
      <Button asChild className="self-start">
        <Link href={destination}>{t('continue')}</Link>
      </Button>
    </div>
  );
}
