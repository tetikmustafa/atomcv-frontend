'use client';

/**
 * Taking your data with you (§ 57.5, § 58.2).
 *
 * This is the portability half of a promise three pieces of user-facing copy
 * already make — the privacy policy's list of rights, the terms' notice
 * period, and the sentence `GENERATION_PAUSED` shows when generation is
 * switched off. The endpoint and its two client functions existed for two
 * stages before anything called them, which is the shape a legal commitment
 * takes when it is only ever written down.
 *
 * **Two formats, and the difference is worth a sentence.** JSON is complete
 * and machine-readable — the copy that could be loaded somewhere else in
 * full. Markdown is lossy and readable, for pasting into a document. Offering
 * both without saying which is which would leave the choice to a guess.
 *
 * **Drawn for everybody, including anonymous sessions.** The endpoint
 * declares no `401`, `capabilities` carries no flag for it, and § 58.2 makes
 * portability unconditional. A profile that expires in two hours is the one
 * most worth copying before it does.
 *
 * The bytes are built here rather than fetched as a file: the endpoint
 * answers with a document, not an attachment, so there is no
 * `Content-Disposition` to take a name from. `GenerationResult` does the
 * blob-and-anchor half the same way, and for the same reason — a plain link
 * would navigate, and a navigation turns a refusal into a page of JSON.
 */

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Button } from '@/components/ui/button';
import { useExportProfile, type ExportFormat } from '@/hooks/useProfile';
import { announce } from '@/stores/announcerStore';

const MEDIA_TYPE: Record<ExportFormat, string> = {
  json: 'application/json',
  markdown: 'text/markdown',
};

const EXTENSION: Record<ExportFormat, string> = {
  json: 'json',
  markdown: 'md',
};

/**
 * The date the copy was made, from the server's own `exportedAt` where it
 * sent one.
 *
 * Only the JSON body carries it — Markdown is a document, not a record — so
 * the fallback is today. A filename is not a claim about provenance; it is
 * how somebody tells two downloads apart a month later.
 */
function stampFor(payload: unknown): string {
  const exportedAt =
    typeof payload === 'object' && payload !== null && 'exportedAt' in payload
      ? (payload as { exportedAt?: unknown }).exportedAt
      : undefined;

  const when = typeof exportedAt === 'string' ? new Date(exportedAt) : new Date();

  return Number.isNaN(when.getTime())
    ? new Date().toISOString().slice(0, 10)
    : when.toISOString().slice(0, 10);
}

export function DataExport() {
  const t = useTranslations('Settings.export');
  const id = useId();
  const save = useExportProfile();

  // Which button is waiting. `variables` is the mutation's own record of what
  // was asked for, so there is no second piece of state to keep true.
  const pending = save.isPending ? save.variables : undefined;

  function take(format: ExportFormat) {
    save.mutate(format, {
      onSuccess: (payload) => {
        const body = format === 'json' ? JSON.stringify(payload, null, 2) : String(payload);
        const url = URL.createObjectURL(new Blob([body], { type: MEDIA_TYPE[format] }));
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = `atomcv-profile-${stampFor(payload)}.${EXTENSION[format]}`;
        anchor.click();

        URL.revokeObjectURL(url);
        // Rule 6: a download that starts in another part of the browser is
        // invisible here, so it is said rather than shown.
        announce(t('announceStarted'));
      },
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-lg font-medium">
        {t('title')}
      </h2>

      <p className="text-muted-foreground text-sm">{t('intro')}</p>

      {save.error && <ErrorPanel error={save.error} />}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => take('json')}
          disabled={save.isPending}
        >
          {pending === 'json' ? t('preparing') : t('json')}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => take('markdown')}
          disabled={save.isPending}
        >
          {pending === 'markdown' ? t('preparing') : t('markdown')}
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">{t('formats')}</p>
    </section>
  );
}
