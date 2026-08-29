'use client';

/**
 * The covering letter (§ 34, `B-056`).
 *
 * **Plain text, and it stays plain text.** § 34.7 produces no document
 * because a letter is pasted into a form or an email, so what this screen
 * owes is the words and an easy way to take them — not a second PDF.
 *
 * **A refusal here is not a fault.** A letter has no original to fall back
 * on: in the CV a rejected sentence is replaced by the person's own wording,
 * and in a letter there is nothing to print instead, so the draft is thrown
 * away. The reader did nothing wrong and there is nothing to fix — another
 * press is a different draft — which is why that one code is drawn as a note
 * beside the button rather than in the error panel.
 *
 * That is not a `switch (code)` creeping back in. The panel exists so the
 * *server* decides what a screen offers; here the only resolution it sends is
 * `retry`, and the button that would carry it is the one already on screen
 * asking for a draft.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCoverLetter } from '@/hooks/useGeneration';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { toErrorLike } from '@/lib/errors/errorLike';
import type { CoverLetterRequest } from '@/lib/api/endpoints/generations';
import { announce } from '@/stores/announcerStore';

/** The one refusal that is a verdict on a draft rather than on the request. */
const REJECTED = 'COVER_LETTER_REJECTED';

/**
 * The three the schema names.
 *
 * A closed vocabulary the server owns, so a fourth would arrive as a
 * typecheck failure here rather than as a value nothing offers. Unlike the
 * resolution actions, there is nothing to keep open: a style this build has
 * never heard of has no control to render and no meaning to guess at.
 */
const STYLES = [
  'default',
  'shorter',
  'more_formal',
] as const satisfies readonly CoverLetterRequest['style'][];

export type CoverLetterProps = {
  generationId: string;
  /** The letter as it stands, or nothing if none has been written yet. */
  letter: string | undefined;
};

export function CoverLetter({ generationId, letter }: CoverLetterProps) {
  const t = useTranslations('Result');
  const describe = useErrorMessage();
  const write = useCoverLetter(generationId);

  const [style, setStyle] = useState<CoverLetterRequest['style']>('default');
  const [companyNote, setCompanyNote] = useState('');
  const [copied, setCopied] = useState(false);

  const failure = write.error ? toErrorLike(write.error) : null;
  const rejected = failure?.code === REJECTED;

  async function copy() {
    if (!letter) return;

    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      // Rule 6: the only other sign is a word changing on a button, which a
      // screen reader has no reason to revisit.
      announce(t('coverLetterCopied'));
    } catch {
      // A browser that refuses the clipboard — permissions, an insecure
      // origin — leaves the text on screen to select by hand, which is what
      // the button was saving rather than enabling.
      setCopied(false);
    }
  }

  return (
    <section className="border-border flex flex-col gap-3 rounded-md border p-4">
      <h2 className="text-sm font-medium">{t('coverLetterTitle')}</h2>

      {letter ? (
        <>
          {/*
            `whitespace-pre-wrap` because the blank lines between parts are
            the letter's only structure (§ 34.7). Rendering it into paragraphs
            would mean deciding what a paragraph is, and the copy button would
            then hand over something that no longer matched what was on screen.
          */}
          <p data-testid="cover-letter" className="text-sm whitespace-pre-wrap">
            {letter}
          </p>

          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
              {copied ? t('coverLetterCopied') : t('coverLetterCopy')}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">{t('coverLetterAbsent')}</p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer">{t('coverLetterOptions')}</summary>

        <div className="flex flex-col gap-3 pt-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t('coverLetterStyle')}</legend>
            {STYLES.map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cover-letter-style"
                  value={option}
                  checked={style === option}
                  onChange={() => setStyle(option)}
                />
                {t(`coverLetterStyles.${option}`)}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="company-note">{t('coverLetterNote')}</Label>
            <Textarea
              id="company-note"
              rows={2}
              value={companyNote}
              placeholder={t('coverLetterNotePlaceholder')}
              onChange={(event) => setCompanyNote(event.target.value)}
            />
            {/* § 34: used as given, nothing inferred from it. Saying so is
                what stops it being written as a prompt. */}
            <p className="text-muted-foreground text-xs">{t('coverLetterNoteHint')}</p>
          </div>
        </div>
      </details>

      {failure && !rejected && <ErrorPanel error={write.error} />}

      {rejected && (
        <p role="status" data-testid="cover-letter-rejected" className="text-sm">
          {describe(failure)}
        </p>
      )}

      <div>
        <Button
          type="button"
          size="sm"
          disabled={write.isPending}
          onClick={() => {
            setCopied(false);
            write.mutate({
              // Always stated, never left to the default. The generator makes
              // it required because the server defaults it, and the reason
              // `acknowledgePreflight` is written out applies here too: a body
              // that says what it asked for cannot drift.
              style,
              ...(companyNote.trim() ? { companyNote: companyNote.trim() } : {}),
            });
          }}
        >
          {write.isPending
            ? t('coverLetterWriting')
            : letter
              ? t('coverLetterAnother')
              : t('coverLetterAsk')}
        </Button>
      </div>
    </section>
  );
}
