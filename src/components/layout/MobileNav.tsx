'use client';

/**
 * The phone's header: the mark, and a button that opens everything else.
 *
 * Below `lg` six routes and three controls do not fit a row — the old header
 * put them on one line with no wrap, and on a 375px screen it ran off the
 * edge. The sheet holds the same `AppSidebar` the desktop shows, so nothing is
 * phone-only or desktop-only.
 *
 * The sheet itself is `MobileMenu`, imported on the first press: the button
 * says it opens a dialog (`aria-haspopup`), and focus returns to it on close
 * because the dialog's `onOpenChange` hands it back.
 */

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { APP_NAME } from '@/lib/seo';
import { Logo } from './Logo';

const MobileMenu = dynamic(() => import('./MobileMenu'), { ssr: false });

export function MobileNav() {
  const t = useTranslations('Nav');
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
      <Link href="/" aria-label={t('home', { appName: APP_NAME })} className="rounded-lg">
        <Logo />
      </Link>

      <Button
        ref={trigger}
        type="button"
        variant="outline"
        size="icon"
        aria-label={t('openMenu')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      >
        <Menu aria-hidden="true" />
      </Button>

      {loaded && (
        <MobileMenu
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) trigger.current?.focus();
          }}
        />
      )}
    </div>
  );
}
