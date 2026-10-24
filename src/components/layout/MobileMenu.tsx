'use client';

/**
 * The phone's sheet, loaded the first time the menu is opened.
 *
 * Split from `MobileNav` so the dialog it is built on — focus trap, portal,
 * dismissal — is not in the initial bundle of every route for a menu most
 * desktop sessions never open (rule 4, `bundle-budget.json`).
 */

import { useTranslations } from 'next-intl';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { AppSidebar } from './AppSidebar';

export default function MobileMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Nav');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" closeLabel={t('closeMenu')} aria-describedby={undefined}>
        <SheetTitle className="sr-only">{t('menuTitle')}</SheetTitle>
        <AppSidebar onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
