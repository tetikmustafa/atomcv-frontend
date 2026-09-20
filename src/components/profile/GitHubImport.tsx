'use client';

/**
 * Bringing in what a public GitHub account already says (`B-106`, § 31.8).
 *
 * **Two steps, and the first writes nothing.** "Offered, never added
 * automatically" is the rule; the split is how it is kept. Nothing reaches
 * the profile until somebody ticks a box and presses the second button.
 *
 * **Nothing is connected and nothing is authorised.** Only public data is
 * read, so no token is asked for and none is kept — and the screen must not
 * imply otherwise. A button reading "Connect GitHub" would be asking for
 * something the product does not want and does not use.
 *
 * **A merge and a new project are drawn apart**, because they do different
 * things to somebody's own writing:
 *
 * - a suggestion carrying `matchedEntryId` is a **merge** onto a project they
 *   already wrote about. It adds the repository's languages and puts the link
 *   on the entry, and **their sentences are never touched** — they wrote them
 *   about what the work was for, and GitHub knows what it was written in.
 * - one with no match becomes a **new project**, with GitHub's own
 *   description as its first line — which is the case where words nobody in
 *   this profile wrote do arrive, and the reader should know that before
 *   ticking it rather than after.
 *
 * **Everything starts unticked.** A list that arrived pre-selected would make
 * "offered" a formality: the fastest path through the screen would be to
 * accept all of it, which is the automatic addition the rule forbids.
 *
 * **An empty answer is one state, not four.** An account that does not exist,
 * a GitHub that will not answer and an account with nothing significant in it
 * come back as the same empty list — none of them is something a person can
 * act on, so the screen says the one true thing rather than guessing which.
 */

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApplyGitHubSuggestions, useGitHubSuggestions } from '@/hooks/useProfile';
import type { GitHubSuggestion } from '@/lib/api/endpoints/profile';
import { announce } from '@/stores/announcerStore';

export function GitHubImport() {
  const t = useTranslations('Editor.github');
  const suggest = useGitHubSuggestions();
  const apply = useApplyGitHubSuggestions();

  const usernameId = useId();
  const [username, setUsername] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const suggestions: GitHubSuggestion[] = suggest.data ?? [];
  const asked = suggest.isSuccess;

  function look() {
    setPicked([]);
    const trimmed = username.trim();

    // Absent rather than empty: without it the server reads the account named
    // in the profile's own contact block, which is the one the CV shows an
    // employer. An empty string would be a username nobody has.
    suggest.mutate(trimmed === '' ? undefined : trimmed, {
      onSuccess: (found) => announce(t('announceFound', { count: found.length })),
    });
  }

  function add() {
    if (picked.length === 0) return;

    const trimmed = username.trim();

    apply.mutate(
      { repositories: picked, ...(trimmed === '' ? {} : { username: trimmed }) },
      {
        onSuccess: (result) => {
          announce(t('announceApplied', { count: result.applied ?? 0 }));
          // The list is spent: every row on it either landed or was skipped,
          // and offering it again would invite a second write of the same
          // repositories.
          suggest.reset();
          setPicked([]);
        },
      },
    );
  }

  return (
    <section className="border-border flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-base font-medium">{t('title')}</h3>
      <p className="text-muted-foreground text-sm">{t('intro')}</p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={usernameId}>{t('usernameLabel')}</Label>
          <Input
            id={usernameId}
            value={username}
            disabled={suggest.isPending || apply.isPending}
            placeholder={t('usernamePlaceholder')}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <Button type="button" onClick={look} disabled={suggest.isPending || apply.isPending}>
          {suggest.isPending ? t('looking') : t('look')}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">{t('usernameHint')}</p>

      {suggest.error && <ErrorPanel error={suggest.error} />}

      {asked && suggestions.length === 0 && (
        <p data-testid="github-empty" className="text-muted-foreground text-sm">
          {t('empty')}
        </p>
      )}

      {suggestions.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {suggestions.map((suggestion) => {
              const name = suggestion.name ?? '';
              const merges = suggestion.matchedEntryId !== undefined;

              return (
                <li key={name} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={`${usernameId}-${name}`}
                    checked={picked.includes(name)}
                    disabled={apply.isPending}
                    className="mt-1"
                    onChange={(event) =>
                      setPicked((current) =>
                        event.target.checked
                          ? [...current, name]
                          : current.filter((candidate) => candidate !== name),
                      )
                    }
                  />
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor={`${usernameId}-${name}`} className="font-normal">
                      {name}
                    </Label>

                    {suggestion.description && (
                      <p className="text-muted-foreground text-xs">{suggestion.description}</p>
                    )}

                    {/*
                      What ticking it would do, said before it is ticked. The
                      two outcomes are not variations of one — a merge leaves
                      somebody's own sentences alone, and a new project brings
                      in words they did not write.
                    */}
                    <p
                      data-testid={`github-effect-${name}`}
                      className="text-muted-foreground text-xs"
                    >
                      {merges ? t('willMerge') : t('willAdd')}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {apply.error && <ErrorPanel error={apply.error} />}

          <Button
            type="button"
            className="w-fit"
            disabled={picked.length === 0 || apply.isPending}
            onClick={add}
          >
            {apply.isPending ? t('adding') : t('add', { count: picked.length })}
          </Button>
        </>
      )}
    </section>
  );
}
