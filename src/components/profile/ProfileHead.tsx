'use client';

/**
 * The profile's own details: the headline, how to reach you, and the free text
 * about yourself. Everything above the sections.
 *
 * **One autosave for the whole head, not one per field.** That is a departure
 * from the atom editor, and `PUT` is the reason: the endpoint replaces the
 * resource, so every save carries all nine fields. With a save per field, two
 * quick edits would race — the second request would be built from a cache that
 * had not yet received the first response, and would put the old headline back
 * on top of the new one. One `useAutosave` serialises them instead: it holds a
 * single pending value and never has two saves in flight.
 *
 * Bölüm 37.1 still holds — no Save button anywhere, edits save themselves.
 * What changes is the granularity, not the strategy.
 *
 * **`sourceLanguage` and `enabledLanguages` are passed through untouched.**
 * They are the content-language axis (Bölüm 38.1), not the interface one, and
 * which languages a profile may offer is a server `capabilities` question that
 * Stage 1 does not publish. Reusing `routing.locales` here is precisely what
 * `lib/i18n/locales.ts` warns against, and hardcoding a list is the assumption
 * the anonymous-mode rule forbids. So the form carries the current values
 * forward — `enabledLanguages` is required on this endpoint, and dropping it
 * is a `400` naming it, verified — and the control that edits them arrives
 * with `capabilities`. What changed with `B-035` is only that
 * `sourceLanguage` must now be *present* in the body, not that the editor may
 * choose it.
 *
 * Email is not validated here. The server does it and says which field
 * (`400`, `params.fields: ["contact.email"]`, verified), which the save status
 * and error panel already render. A second copy of that rule is how the two
 * drift apart.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SaveStatus } from '@/components/editor/SaveStatus';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAutosave } from '@/hooks/useAutosave';
import { useReplaceProfile } from '@/hooks/useProfile';
import type { Profile, ProfileUpdate } from '@/lib/api/endpoints/profile';

/** The contact fields, in the order they are asked for. */
const CONTACT_FIELDS = [
  'name',
  'email',
  'phone',
  'location',
  'linkedin',
  'github',
  'website',
] as const;

type Contact = NonNullable<ProfileUpdate['contact']>;

/**
 * The head as a complete write body.
 *
 * Built from the whole cached profile rather than from the edited field,
 * because `PUT` clears what it is not sent — a body assembled from one input
 * would erase the other eight.
 */
function toUpdate(profile: Profile): ProfileUpdate {
  return {
    headline: profile.headline ?? '',
    contact: { ...(profile.contact ?? {}) },
    selfDescription: profile.selfDescription ?? '',
    // Both are required in the body now (`B-035`), and both are carried
    // forward rather than defaulted. `sourceLanguage` used to be the one field
    // an omitting `PUT` left alone — that exception is gone, and it could not
    // simply start clearing: the column is `NOT NULL` and falling back to its
    // default would have turned a Turkish profile English on any head edit. So
    // it is required instead, and omitting either is a 400 naming it.
    sourceLanguage: profile.sourceLanguage,
    enabledLanguages: profile.enabledLanguages ?? [],
  };
}

export function ProfileHead({ profile }: { profile: Profile }) {
  const t = useTranslations('Editor.head');
  const replace = useReplaceProfile();
  const [open, setOpen] = useState(false);

  /*
    Seeded once and then owned by the fields, the same rule as the atom
    editor's `draft`: re-reading the cache every render would write the
    server's copy back mid-sentence and move the caret.
  */
  const [draft, setDraft] = useState<ProfileUpdate | null>(null);
  const value = draft ?? toUpdate(profile);

  const autosave = useAutosave<ProfileUpdate>({
    trigger: 'text',
    save: (next) => replace.mutateAsync(next),
  });

  function edit(change: Partial<ProfileUpdate>) {
    const next = { ...value, ...change };
    setDraft(next);
    autosave.change(next);
  }

  const contact = value.contact ?? {};
  const summary = [contact.name, contact.email, contact.location].filter(Boolean).join(' · ');
  const panelId = 'profile-head-panel';

  return (
    <section aria-labelledby="profile-head-heading" className="flex flex-col gap-2">
      <h2 id="profile-head-heading" className="sr-only">
        {t('title')}
      </h2>

      {/* Visible whether or not the panel is open: until this existed, a
          profile's own contact details appeared nowhere in the editor. */}
      {summary && <p className="text-muted-foreground text-sm">{summary}</p>}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          // Closing flushes rather than cancels, for the same reason
          // collapsing a section does: a sentence finished a moment ago must
          // not disappear with the panel (P8).
          if (open) autosave.flush();
          setOpen(!open);
        }}
      >
        {open ? t('hide') : t('edit')}
      </Button>

      {open && (
        <div id={panelId} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="head-headline">{t('headline')}</Label>
            <Input
              id="head-headline"
              value={value.headline ?? ''}
              onChange={(event) => edit({ headline: event.target.value })}
              onBlur={autosave.flush}
            />
          </div>

          {CONTACT_FIELDS.map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <Label htmlFor={`head-${field}`}>{t(field)}</Label>
              <Input
                id={`head-${field}`}
                type={field === 'email' ? 'email' : 'text'}
                value={contact[field] ?? ''}
                onChange={(event) =>
                  edit({ contact: { ...contact, [field]: event.target.value } as Contact })
                }
                onBlur={autosave.flush}
              />
            </div>
          ))}

          <div className="flex flex-col gap-2">
            <Label htmlFor="head-selfDescription">{t('selfDescription')}</Label>
            <Textarea
              id="head-selfDescription"
              rows={3}
              value={value.selfDescription ?? ''}
              onChange={(event) => edit({ selfDescription: event.target.value })}
              onBlur={autosave.flush}
            />
          </div>

          <SaveStatus
            status={autosave.status}
            onRetry={autosave.retry}
            onDiscard={() => {
              autosave.discard();
              // Back to the server's copy, which is what "take theirs" means.
              setDraft(null);
            }}
          />

          {/*
            `SaveStatus` says a save failed; it does not say why, and for the
            rest of the editor that is right — an atom's save fails for
            transient reasons and the sentence would be noise.

            Not here. This is the one resource with a field the server
            validates: a malformed email is a `400` naming `contact.email`,
            and "Couldn't save." leaves the user retrying a request that will
            never succeed. So the server's own sentence is rendered too
            (rules 7 and 8).

            No `onRetry` on the panel: `SaveStatus` already owns that action,
            and `isRetriable` says no to a 4xx anyway. `conflict` is excluded
            because 37.4's two buttons are the answer there, and a second
            explanation beside them would be competing advice.
          */}
          {autosave.status === 'error' && autosave.error ? (
            <ErrorPanel error={autosave.error} />
          ) : null}
        </div>
      )}
    </section>
  );
}
