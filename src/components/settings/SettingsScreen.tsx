'use client';

/**
 * Two things, and they belong to different owners.
 *
 * **What belongs to the profile** — how the CV looks, how it is written, and
 * the copy you can take away — is drawn for everybody. An anonymous caller
 * has a profile too: a narrower one (preset templates, no Layer B, one
 * language), but a real one, so those sections gate themselves on
 * `capabilities` rather than on having an account. Export gates on nothing at
 * all: § 58.2 makes portability unconditional, and a profile that expires in
 * two hours is the one most worth copying.
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
import { DeleteProfile } from '@/components/settings/DeleteProfile';
import { GenerationDefaults } from '@/components/settings/GenerationDefaults';
import { LifecycleEmails } from '@/components/settings/LifecycleEmails';
import { useSession } from '@/hooks/useSession';
import { Link } from '@/lib/i18n/navigation';

const SECTIONS = ['appearance', 'defaults', 'data', 'emails', 'danger'] as const;

export function SettingsScreen() {
  const t = useTranslations('Settings');
  const { data: session } = useSession();

  // Nothing while the session is still on its way. Both branches make a claim
  // about the reader, and the wrong one is worse than a moment of nothing.
  if (!session) return null;

  // The two that exist only for an account are listed only for one, so the
  // contents never point at a section that is not on the page.
  const listed = SECTIONS.filter(
    (key) => session.authenticated || (key !== 'emails' && key !== 'danger'),
  );

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
      {/*
        In-page links rather than tabs: every section stays on the page, so
        search, the browser's find and a screen reader's heading list all
        still reach it — the contents only make a long page short to cross.
      */}
      <nav aria-label={t('sectionsLabel')} className="lg:sticky lg:top-6">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {listed.map((key) => (
            <li key={key}>
              <a
                href={`#settings-${key}`}
                className="text-muted-foreground hover:bg-muted hover:text-foreground block rounded-lg px-3 py-1.5 text-sm whitespace-nowrap"
              >
                {t(`nav.${key}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-6">
        <div id="settings-appearance" className="scroll-mt-24">
          <CvAppearance />
        </div>
        <div id="settings-defaults" className="scroll-mt-24">
          <GenerationDefaults />
        </div>
        <div id="settings-data" className="scroll-mt-24">
          <DataExport />
        </div>

        {session.authenticated ? (
          <>
            <div id="settings-emails" className="scroll-mt-24">
              <LifecycleEmails />
            </div>
            {/*
              Set apart by its border and its heading rather than by colour
              alone (rule 6): both of these are permanent, and the page says so
              before either button is in reach.
            */}
            <section
              id="settings-danger"
              aria-labelledby="settings-danger-heading"
              className="border-destructive/40 bg-card flex scroll-mt-24 flex-col gap-6 rounded-xl border p-5 sm:p-6"
            >
              <div className="flex flex-col gap-1">
                <h2 id="settings-danger-heading" className="text-lg font-semibold">
                  {t('dangerTitle')}
                </h2>
                <p className="text-muted-foreground text-sm">{t('dangerIntro')}</p>
              </div>
              <DeleteProfile />
              <div className="border-t pt-6">
                <DeleteAccount />
              </div>
            </section>
          </>
        ) : (
          <p className="bg-muted/60 text-muted-foreground rounded-xl border px-4 py-3 text-sm">
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
    </div>
  );
}
