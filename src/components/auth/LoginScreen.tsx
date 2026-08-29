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
 * `next` is where they were, so signing in returns them to it instead of to
 * a home page they then have to navigate out of.
 */

import { useTranslations } from 'next-intl';
import { ProviderButtons } from '@/components/auth/ProviderButtons';
import { useProviders } from '@/hooks/useSession';

export function LoginScreen({ next }: { next: string }) {
  const t = useTranslations('Auth');
  const { data: providers, isPending } = useProviders();

  // Only once the list has actually answered. Saying "there is no way to sign
  // in here" while the request is still open would be a wrong sentence that
  // then quietly turns into buttons.
  const nothingToOffer = !isPending && !providers?.length;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-8 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('accountIsFor')}</p>
      </div>

      <ProviderButtons next={next} />

      {nothingToOffer && (
        <p role="status" className="text-muted-foreground text-sm">
          {t('unavailable')}
        </p>
      )}
    </div>
  );
}
