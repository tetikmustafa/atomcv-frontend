'use client';

/**
 * The way in.
 *
 * Reached on purpose, never pushed: § 9 promises anonymous work that is
 * narrower, not worse, so nothing in the product interrupts to ask for an
 * account. That is also why this page says what an account is *for* rather
 * than what the reader is missing — the person who arrived here already
 * decided, and the person who did not is not reading it.
 *
 * Two ways in, and the second is why nothing here has an "unavailable" state:
 * a deployment can be configured with no OAuth provider at all, but the magic
 * link is always there.
 *
 * `next` is where they were, so signing in returns them to it instead of to
 * a home page they then have to navigate out of. It reaches the providers
 * only: a link that arrives by email has no idea what the reader was doing in
 * a browser it may never open.
 */

import { useTranslations } from 'next-intl';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';
import { ProviderButtons } from '@/components/auth/ProviderButtons';
import { useProviders } from '@/hooks/useSession';

export function LoginScreen({ next }: { next: string }) {
  const t = useTranslations('Auth');
  const { data: providers } = useProviders();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-8 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('accountIsFor')}</p>
      </div>

      <ProviderButtons next={next} />

      {/*
        Drawn only when there is something on both sides of it. A rule with
        "or" in the middle of it, above a form and below nothing, describes a
        choice the reader does not have.
      */}
      {!!providers?.length && (
        <div className="flex items-center gap-3">
          <span className="border-border h-px flex-1 border-t" />
          <span className="text-muted-foreground text-xs uppercase">{t('or')}</span>
          <span className="border-border h-px flex-1 border-t" />
        </div>
      )}

      <MagicLinkForm />
    </div>
  );
}
