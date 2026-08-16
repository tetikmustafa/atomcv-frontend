'use client';

/**
 * The profile screen: the head, how complete it is, and the sections.
 *
 * Client-side because everything under it reads TanStack Query and writes
 * through it. The route itself stays a server component — see the page — so
 * the shell and the translations are still rendered on the server.
 */

import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { CompletenessBar } from '@/components/profile/CompletenessBar';
import { SectionList } from '@/components/profile/SectionList';
import { useProfile } from '@/hooks/useProfile';

export function ProfileEditor() {
  const t = useTranslations('Editor.profile');
  const { data, isPending, error, refetch } = useProfile();

  if (isPending) return <p className="text-muted-foreground text-sm">{t('loading')}</p>;

  // `isRetriable` is what decides whether a retry is honest, and a failed read
  // of the head is either a network problem or a 5xx — both worth repeating.
  if (error) return <ErrorPanel error={error} onRetry={() => void refetch()} />;

  const profile = data.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">{profile.headline || t('untitled')}</h1>

        {/*
          `GET /profile` never 404s — an account without one gets an empty
          profile created on read (D.9 · 13). So there is no "you have no
          profile yet" state to build, only a completeness of 0.
        */}
        <CompletenessBar value={profile.completeness ?? 0} />
      </header>

      <SectionList />
    </div>
  );
}
