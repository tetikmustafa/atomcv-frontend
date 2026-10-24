'use client';

/**
 * Starting the profile again, without losing the account.
 *
 * Counts in the confirmation, as every deletion here has — the control says
 * "delete my profile" and the server hears "delete these sections, these items
 * and every resume made from them" (`useDeleteProfile` says why the last part
 * is true). After it, the import is where to go: an empty profile is what the
 * next read returns, and bringing a CV is the default way to fill one.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DeleteDialog } from '@/components/profile/DeleteDialog';
import { Button } from '@/components/ui/button';
import { useAtoms, useDeleteProfile, useProfile, useSections } from '@/hooks/useProfile';
import { useRouter } from '@/lib/i18n/navigation';
import { announce } from '@/stores/announcerStore';

export function DeleteProfile() {
  const t = useTranslations('Settings');
  const router = useRouter();
  const remove = useDeleteProfile();
  const [open, setOpen] = useState(false);

  // Read so the head's version is in the cache: the delete sends it back as
  // If-Match, and a head never read has none.
  useProfile();
  const { data: sections } = useSections();
  const { data: atoms } = useAtoms();

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold">{t('deleteProfileTitle')}</h3>
      <p className="text-muted-foreground text-sm">{t('deleteProfileIntro')}</p>

      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="w-fit"
        onClick={() => {
          remove.reset();
          setOpen(true);
        }}
      >
        {t('deleteProfileAction')}
      </Button>

      {open && (
        <DeleteDialog
          open={open}
          onOpenChange={setOpen}
          title={t('deleteProfileConfirmTitle')}
          description={t('deleteProfileConfirmBody', {
            sections: sections?.length ?? 0,
            atoms: atoms?.length ?? 0,
          })}
          confirmLabel={t('deleteProfileConfirm')}
          isPending={remove.isPending}
          error={remove.error}
          onConfirm={async () => {
            await remove.mutateAsync();
            announce(t('deleteProfileDone'));
            router.push('/onboarding');
          }}
        />
      )}
    </div>
  );
}
