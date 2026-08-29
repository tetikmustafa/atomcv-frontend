'use client';

/**
 * One button per provider the deployment can actually sign people in with.
 *
 * The list comes from the server (§ 40.6.1). Hardcoding Google and GitHub
 * would draw a button that answers `provider_disabled` on a deployment
 * without the credentials — an offered way in that fails only once the person
 * has already left our site.
 *
 * Anchors rather than buttons, and that is the whole mechanism: the browser
 * has to own this navigation so the provider's consent screen arrives with
 * its own address in the address bar (`oauthStartUrl` carries the rest of the
 * reasoning). They are keyboard-reachable for free, which is rule 5's easiest
 * case and worth not breaking with a click handler.
 */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useProviders } from '@/hooks/useSession';
import { oauthStartUrl } from '@/lib/api/endpoints/auth';

/**
 * How each provider spells its own name.
 *
 * A map, never a transform. Rule 11: the ids are a wire vocabulary, and
 * capitalising one with a locale-sensitive call is the Turkish dotted-i trap
 * — under `tr`, an id beginning with `i` would come back with a dot on it.
 *
 * A provider we have no spelling for still gets a button, showing its raw id.
 * Dropping it would hide a working way in because we were late to add a line
 * to this map; `github` reads worse than `GitHub` and lets the person sign
 * in, which is the trade the right way round.
 */
const DISPLAY_NAMES: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
};

export function ProviderButtons({ next }: { next: string }) {
  const t = useTranslations('Auth');
  const { data: providers } = useProviders();

  // Nothing while it loads, and nothing when the deployment has none. Both
  // are "there is no button here", and a skeleton in the place of a control
  // that may never appear is a promise the screen cannot keep.
  if (!providers?.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <Button key={provider} asChild variant="outline" size="lg" className="justify-center">
          <a href={oauthStartUrl(provider, next)}>
            {t('continueWith', { provider: DISPLAY_NAMES[provider] ?? provider })}
          </a>
        </Button>
      ))}
    </div>
  );
}
