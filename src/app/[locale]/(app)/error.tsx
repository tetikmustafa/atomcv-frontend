'use client';

/**
 * A screen that threw while rendering.
 *
 * Not where request errors go — those reach `ErrorPanel` with the server's own
 * resolutions (rule 7). This is the boundary for a bug: a component that
 * threw, which until now unmounted the whole app and left a blank page. The
 * navigation stays (it is in the layout above this boundary), the reader is
 * told their data is untouched — it is, nothing here writes — and `retry`
 * re-renders the segment.
 *
 * The digest is shown, small, because it is the one thing that lets a report
 * be matched to a server log; the message is not, because in production it is
 * either generic or somebody's content.
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations('Shell');

  useEffect(() => {
    // The console, and nothing richer: Sentry is a deploy-day decision
    // (`notes/current.md`), and this is where it would be called.
    console.error(error);
  }, [error]);

  return (
    <Page width="narrow">
      <div
        role="alert"
        className="bg-card shadow-card flex flex-col items-center gap-4 rounded-xl border px-6 py-12 text-center"
      >
        <span className="bg-muted flex size-12 items-center justify-center rounded-full">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold">{t('errorTitle')}</h1>
        <p className="text-muted-foreground max-w-md">{t('errorBody')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => retry()}>
            {t('errorRetry')}
          </Button>
          <Link href="/" className={buttonVariants({ variant: 'outline' })}>
            {t('errorHome')}
          </Link>
        </div>
        {error.digest && <p className="text-muted-foreground font-mono text-xs">{error.digest}</p>}
      </div>
    </Page>
  );
}
