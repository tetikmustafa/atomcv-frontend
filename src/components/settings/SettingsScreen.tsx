'use client';

/**
 * Everything that belongs to the account rather than to the work.
 *
 * Today that is one thing — deleting it — and the screen exists because
 * § 57.4 requires the deletion to be reachable and to be explained before it
 * happens.
 *
 * **The gate is the session, not a capability flag.** Deleting an account is
 * not a feature an anonymous caller has a narrower version of: there is no
 * account. `capabilities` says nothing about it and should not, so this reads
 * `authenticated` directly — the one place in the app where that question is
 * the right one to ask.
 */

import { useTranslations } from 'next-intl';
import { DeleteAccount } from '@/components/settings/DeleteAccount';
import { useSession } from '@/hooks/useSession';
import { Link } from '@/lib/i18n/navigation';

export function SettingsScreen() {
  const t = useTranslations('Settings');
  const { data: session } = useSession();

  // Nothing while the session is still on its way. Both branches make a claim
  // about the reader, and the wrong one is worse than a moment of nothing.
  if (!session) return null;

  if (!session.authenticated) {
    return (
      <p className="text-muted-foreground text-sm">
        {t.rich('anonymous', {
          link: (chunks) => (
            <Link href="/login?next=%2Fsettings" className="underline underline-offset-4">
              {chunks}
            </Link>
          ),
        })}
      </p>
    );
  }

  return <DeleteAccount />;
}
