'use client';

/**
 * "Are you sure" — and this screen is the whole of it (§ 57.4, `B-057`).
 *
 * The endpoint takes no body and no confirmation flag: it is behind the
 * session cookie and a CSRF token already, and a second lock on the same door
 * would put the decision somewhere the reader never sees. So the confirmation
 * is a screen, and what it owes is a **count** — the same rule the cascading
 * deletes in the editor follow. What cannot be undone has to be named before
 * it happens.
 *
 * **Two things stay, and saying so is part of the honesty rather than a
 * footnote.** Cost history survives with the link to the person cut, and the
 * suppression record for an address that hard-bounced or complained belongs
 * to the address rather than to the account — removing it would let us post
 * somewhere we were told not to. The privacy policy carries the same two
 * sentences; this is where somebody actually reads them.
 *
 * **Afterwards the reader is anonymous, not locked out.** The response clears
 * the cookie and the next session read stamps a fresh anonymous one, so the
 * home page is the right destination and a sign-in wall would be a lie.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DeleteDialog } from '@/components/profile/DeleteDialog';
import { Button } from '@/components/ui/button';
import { useGenerationCount } from '@/hooks/useGeneration';
import { useAtoms, useSections } from '@/hooks/useProfile';
import { useDeleteAccount } from '@/hooks/useSession';
import { useRouter } from '@/lib/i18n/navigation';

export function DeleteAccount() {
  const t = useTranslations('Settings');
  const router = useRouter();
  const remove = useDeleteAccount();
  const [open, setOpen] = useState(false);

  /*
    Counted from what the profile screen already loads, so the sentence is
    about this account rather than about accounts in general.

    Generations used to be named without a number, because nothing published
    one. `GET /generations` does now (`B-066`), and `total` is the account's
    count rather than a page's — which is the only kind of number this screen
    could honestly use: one arrived at by walking pages would be a different
    number by the time the walk finished.
  */
  const { data: sections } = useSections();
  const { data: atoms } = useAtoms();
  const { data: generations } = useGenerationCount();

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{t('deleteTitle')}</h2>
      <p className="text-muted-foreground text-sm">{t('deleteIntro')}</p>

      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="w-fit"
        onClick={() => setOpen(true)}
      >
        {t('deleteAction')}
      </Button>

      {open && (
        <DeleteDialog
          open={open}
          onOpenChange={setOpen}
          title={t('deleteConfirmTitle')}
          description={t('deleteConfirmBody', {
            sections: sections?.length ?? 0,
            atoms: atoms?.length ?? 0,
            generations: generations ?? 0,
          })}
          confirmLabel={t('deleteConfirmAction')}
          isPending={remove.isPending}
          error={remove.error}
          onConfirm={async () => {
            await remove.mutateAsync();
            // Home rather than anywhere in the app: there is no profile left
            // for the editor to show, and the caller is now a fresh anonymous
            // session.
            router.replace('/');
          }}
        />
      )}
    </div>
  );
}
