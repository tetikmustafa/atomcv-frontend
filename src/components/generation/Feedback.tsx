'use client';

/**
 * Was this any good? (§ 48.4, `B-058`)
 *
 * **The thumb is the whole required form.** A form that accepts the verdict
 * before asking why collects more of it and better of it; the category and
 * the comment are for people who have something to say, and they only appear
 * once the verdict is in.
 *
 * **One verdict per generation.** Pressing the other thumb is changing your
 * mind — no second row opens, the existing one is updated — so what is drawn
 * afterwards is the **current selection**, not a thank-you. Somebody who
 * wants to take it back can see what they said.
 *
 * **`contentGranted` is the part that needs care.** Everything else in this
 * product is diagnosed from shapes: character counts, line counts, render
 * cost. This is the single door to the content itself. Ticking it opens
 * forty-eight hours from the first yes — a second yes does not push the
 * window along — and unticking it revokes, which is why every request states
 * the value rather than leaving it out.
 *
 * **`accessedAt` is shown, and that is the point of it.** A permission nobody
 * can check up on is a checkbox. The sentence is built from that field:
 * granted and unread, or read at a particular time.
 *
 * There is no `GET` for any of this, so a reload starts blank rather than
 * guessing at what was said before.
 */

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFeedback } from '@/hooks/useGeneration';
import { announce } from '@/stores/announcerStore';
import type { FeedbackRequest } from '@/lib/api/endpoints/generations';

/** § 48.4's five, in the schema's order. */
const CATEGORIES = [
  'selection',
  'writing',
  'format',
  'density',
  'other',
] as const satisfies readonly NonNullable<FeedbackRequest['category']>[];

/** The server's ceiling, enforced here so a rejected write never happens. */
const COMMENT_MAX = 4000;

export function Feedback({ generationId }: { generationId: string }) {
  const t = useTranslations('Result');
  const format = useFormatter();
  const send = useFeedback(generationId);

  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [category, setCategory] = useState<FeedbackRequest['category']>();
  const [comment, setComment] = useState('');
  const [granted, setGranted] = useState(false);

  /**
   * Every request carries the whole verdict, because two of these fields are
   * switches rather than additions: sending `contentGranted: false` revokes a
   * permission, so a thumb pressed after a grant was opened must not quietly
   * withdraw it.
   */
  function submit(next: { rating?: 1 | -1; contentGranted?: boolean }) {
    const verdict = next.rating ?? rating;
    if (!verdict) return;

    send.mutate(
      {
        rating: verdict,
        contentGranted: next.contentGranted ?? granted,
        ...(category ? { category } : {}),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      },
      { onSuccess: () => announce(t('feedbackRecorded')) },
    );
  }

  const grant = send.data?.contentGrant;

  return (
    <section className="border-border flex flex-col gap-3 rounded-md border p-4">
      <h2 className="text-sm font-medium">{t('feedbackTitle')}</h2>

      <div className="flex gap-2">
        {([1, -1] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant={rating === value ? 'default' : 'outline'}
            size="sm"
            // The selection, not a disabled state: changing your mind is the
            // point of showing it.
            aria-pressed={rating === value}
            disabled={send.isPending}
            onClick={() => {
              setRating(value);
              submit({ rating: value });
            }}
          >
            {value === 1 ? t('feedbackGood') : t('feedbackBad')}
          </Button>
        ))}
      </div>

      {send.error && <ErrorPanel error={send.error} />}

      {/* Only once the verdict is in: asking why before accepting what is the
          order that collects less. */}
      {rating !== null && (
        <details className="text-sm">
          <summary className="cursor-pointer">{t('feedbackMore')}</summary>

          <div className="flex flex-col gap-3 pt-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="feedback-category">{t('feedbackCategory')}</Label>
              <select
                id="feedback-category"
                className="border-border bg-background rounded-md border px-2 py-1 text-sm"
                value={category ?? ''}
                onChange={(event) =>
                  setCategory((event.target.value || undefined) as FeedbackRequest['category'])
                }
              >
                <option value="">{t('feedbackCategoryNone')}</option>
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {t(`feedbackCategories.${option}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="feedback-comment">{t('feedbackComment')}</Label>
              <Textarea
                id="feedback-comment"
                rows={3}
                maxLength={COMMENT_MAX}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
              {/* Rule 4's reason, said out loud: it is kept and never logged,
                  and it is not read back to the reader because they wrote it. */}
              <p className="text-muted-foreground text-xs">{t('feedbackCommentHint')}</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={granted}
                  onChange={(event) => {
                    setGranted(event.target.checked);
                    // Sent at once, both ways: the tick opens the window and
                    // the untick closes it, and a consent that waited for a
                    // second button would be a consent nobody finished giving.
                    submit({ contentGranted: event.target.checked });
                  }}
                />
                <span>{t('feedbackGrant')}</span>
              </label>

              {grant?.open && (
                <p
                  role="status"
                  data-testid="grant-status"
                  className="text-muted-foreground text-xs"
                >
                  {grant.accessedAt
                    ? t('feedbackGrantRead', { at: new Date(grant.accessedAt) })
                    : t('feedbackGrantUnread', {
                        until: grant.expiresAt
                          ? format.dateTime(new Date(grant.expiresAt), 'short')
                          : '',
                      })}
                </p>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              disabled={send.isPending}
              onClick={() => submit({})}
            >
              {send.isPending ? t('feedbackSending') : t('feedbackSend')}
            </Button>
          </div>
        </details>
      )}
    </section>
  );
}
