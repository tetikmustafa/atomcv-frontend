'use client';

/**
 * The profile screen: the head, how complete it is, and the sections.
 *
 * Client-side because everything under it reads TanStack Query and writes
 * through it. The route itself stays a server component — see the page — so
 * the shell and the translations are still rendered on the server.
 */

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { PageHeader } from '@/components/layout/Page';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import { GitHubImport } from '@/components/profile/GitHubImport';
import { ProfileHead } from '@/components/profile/ProfileHead';
import { SectionList } from '@/components/profile/SectionList';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/hooks/useProfile';
import { Link } from '@/lib/i18n/navigation';

/**
 * @param embedded drawn inside another screen that owns the page's `h1` — the
 *                 review after an import. The headline becomes an `h2` there
 *                 and the screen's own way forward replaces "Generate": a page
 *                 with two `h1`s has no single answer to "where am I".
 */
export function ProfileEditor({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations('Editor.profile');
  const { data, isPending, error, refetch } = useProfile();

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="sr-only">
          {t('loading')}
        </p>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  // `isRetriable` is what decides whether a retry is honest, and a failed read
  // of the head is either a network problem or a 5xx — both worth repeating.
  if (error) return <ErrorPanel error={error} onRetry={() => void refetch()} />;

  const profile = data.data;
  const headline = profile.headline || t('untitled');

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {embedded ? (
        <h2 className="text-xl font-semibold">{headline}</h2>
      ) : (
        <PageHeader
          eyebrow={t('title')}
          title={headline}
          description={t('description')}
          actions={
            <Link href="/generate" className={buttonVariants()}>
              <Sparkles aria-hidden="true" />
              {t('generate')}
            </Link>
          }
        />
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
        {/*
          The completeness, beside the work on a wide screen and above it on a
          narrow one. `GET /profile` never 404s — an account without one gets
          an empty profile created on read (`spec/08-api.md`) — so there is no
          "you have no profile yet" state to build, only a completeness of 0.
        */}
        <aside className="xl:sticky xl:top-6 xl:order-last">
          <Card className="gap-3">
            <CardTitle as="h2" className="text-sm">
              {t('completenessTitle')}
            </CardTitle>
            <CompletenessBar value={profile.completeness ?? 0} />
            <CardDescription className="text-xs">{t('completenessHint')}</CardDescription>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <ProfileHead profile={profile} />

          <section aria-labelledby="profile-sections-heading" className="flex flex-col gap-3">
            <h2 id="profile-sections-heading" className="text-lg font-semibold">
              {t('sectionsTitle')}
            </h2>
            <SectionList />
          </section>

          {/*
            Last, and below the sections rather than beside the head (`B-106`).

            It is a way of **adding** to a profile, like the CV upload, and the
            one difference decides the placement: the upload builds a profile
            somebody has none of, so it lives on onboarding. This adds projects
            to one that already exists, and the reader has to be able to see
            what is there before deciding what is missing.

            Drawn for everybody. Nothing about it is an account feature: only
            public data is read, and the capabilities block gates nothing here.
          */}
          <GitHubImport />
        </div>
      </div>
    </div>
  );
}
