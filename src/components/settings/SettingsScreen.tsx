'use client';

/**
 * Two things, and they belong to different owners.
 *
 * **What belongs to the profile** — how the CV looks, and the copy you can
 * take away — is drawn for everybody. An anonymous caller has a profile too:
 * a narrower one (preset templates, no Layer B), but a real one, so the
 * appearance section gates itself on `capabilities` rather than on having an
 * account. Export gates on nothing at all: § 58.2 makes portability
 * unconditional, and a profile that expires in two hours is the one most
 * worth copying.
 *
 * **The account section belongs to an account.** Deleting one is not a
 * feature an anonymous caller has a narrower version of: there is no account.
 * `capabilities` says nothing about it and should not, so this reads
 * `authenticated` directly — the one place in the app where that question is
 * the right one to ask (§ 57.4 requires the deletion to be reachable and to
 * be explained before it happens).
 */

import { useTranslations } from 'next-intl';
import { CvAppearance } from '@/components/settings/CvAppearance';
import { DataExport } from '@/components/settings/DataExport';
import { DeleteAccount } from '@/components/settings/DeleteAccount';
import { LifecycleEmails } from '@/components/settings/LifecycleEmails';
import { useSession } from '@/hooks/useSession';
import { Link } from '@/lib/i18n/navigation';

export function SettingsScreen() {
  const t = useTranslations('Settings');
  const { data: session } = useSession();

  // Nothing while the session is still on its way. Both branches make a claim
  // about the reader, and the wrong one is worse than a moment of nothing.
  if (!session) return null;

  return (
    <div className="flex flex-col gap-10">
      <CvAppearance />
      <DataExport />

      {session.authenticated ? (
        <>
          <LifecycleEmails />
          <DeleteAccount />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t.rich('anonymous', {
            link: (chunks) => (
              <Link href="/login?next=%2Fsettings" className="underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
    </div>
  );
}
