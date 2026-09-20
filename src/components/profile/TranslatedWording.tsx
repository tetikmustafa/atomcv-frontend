'use client';

/**
 * A wording nobody in this profile wrote (`B-107`, § 32.5).
 *
 * `auto` follows the posting now: when the profile has no wording in the
 * target language, the missing ones are translated between Faz B and Faz C
 * and **written back to the profile**. So wordings appear in this editor that
 * the person did not type — `createdBy: llm_translate`, `userEdited: false` —
 * and § 32.5 asks for them to be looked at.
 *
 * **It is a note, not a warning.** Nothing went wrong and nothing is out of
 * date; the sentence is there because it is somebody's own CV and a line they
 * did not write should say so before it goes out under their name.
 *
 * **It ends the moment they touch it.** Editing the wording sets
 * `userEdited`, which is the server recording authorship rather than a flag
 * this screen keeps — so the note disappears for the one reason that means
 * the reading happened. Nothing is dismissible: a dismissal would end the
 * note without ending the fact.
 *
 * Not drawn for an anonymous session, and not by a guard: that session is
 * English-only and has no second language to translate into, so no wording it
 * holds can carry this mark. `StaleWording` next door needs its guard because
 * its state is about the **source** moving, which the fixture can reach; this
 * one cannot be reached at all.
 */

import { useTranslations } from 'next-intl';
import type { Variant } from '@/lib/api/endpoints/profile';

export type TranslatedWordingProps = { variant: Variant };

export function TranslatedWording({ variant }: TranslatedWordingProps) {
  const t = useTranslations('Editor.variants');

  if (variant.createdBy !== 'llm_translate' || variant.userEdited === true) return null;

  return (
    <p role="status" data-testid="translated-wording" className="text-muted-foreground text-xs">
      {t('translated')}
    </p>
  );
}
