'use client';

/**
 * The one email preference there is (§ 57.7, `B-096`).
 *
 * **The list is closed**: a welcome note on the first sign-in, and a
 * confirmation when an account is deleted. Nothing else is sent, and adding
 * something would be a change to the specification rather than to this
 * screen.
 *
 * **The deletion confirmation is not covered by this switch and cannot be.**
 * § 57.4 requires telling somebody their data is gone; a confirmation that
 * could be turned off would be a way of not telling them. So the sentence
 * under the switch says what it does *not* reach — a label reading
 * "informational emails" would quietly claim otherwise.
 *
 * The magic link is not on the list either (§ 40.2): it answers an action the
 * person is taking at that moment, and it is not optional.
 */

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPanel } from '@/components/feedback/ErrorPanel';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAccountSettings, useUpdateAccountSettings } from '@/hooks/useSession';
import { announce } from '@/stores/announcerStore';

export function LifecycleEmails() {
  const t = useTranslations('Settings');
  const id = useId();
  const { data: settings } = useAccountSettings();
  const update = useUpdateAccountSettings();

  // Nothing until the value has arrived: a switch drawn in the wrong position
  // and corrected a moment later is a control that lied about a preference.
  if (!settings) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-lg font-medium">
        {t('emailsTitle')}
      </h2>

      <div className="flex items-center gap-3">
        <Switch
          id={id}
          checked={settings.lifecycleEmails ?? true}
          disabled={update.isPending}
          onCheckedChange={(next) =>
            update.mutate(
              { lifecycleEmails: next },
              // Rule 6: the outcome is spoken, not left to the switch moving.
              { onSuccess: () => announce(next ? t('emailsOn') : t('emailsOff')) },
            )
          }
        />
        <Label htmlFor={id} className="font-normal">
          {t('emailsLabel')}
        </Label>
      </div>

      <p className="text-muted-foreground text-sm">{t('emailsNote')}</p>

      {update.error && <ErrorPanel error={update.error} />}
    </section>
  );
}
