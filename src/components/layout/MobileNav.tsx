'use client';

/**
 * The phone's header: the mark, and a button that opens everything else.
 *
 * Below `lg` six routes and three controls do not fit a row — the old header
 * put them on one line with no wrap, and on a 375px screen it ran off the
 * edge. The sheet holds the same `AppSidebar` the desktop shows, so nothing is
 * phone-only or desktop-only.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Link } from '@/lib/i18n/navigation';
import { APP_NAME } from '@/lib/seo';
import { AppSidebar } from './AppSidebar';
import { Logo } from './Logo';

export function MobileNav() {
  const t = useTranslations('Nav');
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
      <Link href="/" aria-label={t('home', { appName: APP_NAME })} className="rounded-lg">
        <Logo />
      </Link>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="icon" aria-label={t('openMenu')}>
            <Menu aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" closeLabel={t('closeMenu')} aria-describedby={undefined}>
          <SheetTitle className="sr-only">{t('menuTitle')}</SheetTitle>
          <AppSidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
