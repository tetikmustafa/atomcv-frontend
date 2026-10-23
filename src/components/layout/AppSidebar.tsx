'use client';

/**
 * Everything the app's chrome holds: the mark, the routes, the two interface
 * preferences and the session.
 *
 * One component for both places it appears — the sidebar from `lg` up, the
 * sheet below it — so a phone and a desktop never offer different things.
 * `MobileNav` passes `onNavigate` to close the sheet when a link is followed;
 * the sidebar passes nothing.
 */

import { useTranslations } from 'next-intl';
import { SessionControl } from '@/components/auth/SessionControl';
import { Link } from '@/lib/i18n/navigation';
import { APP_NAME } from '@/lib/seo';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Logo } from './Logo';
import { MainNav } from './MainNav';
import { ThemeToggle } from './ThemeToggle';

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('Nav');

  return (
    <div className="flex h-full flex-col gap-6">
      <Link
        href="/"
        onClick={onNavigate}
        aria-label={t('home', { appName: APP_NAME })}
        className="w-fit rounded-lg px-1 text-lg"
      >
        <Logo />
      </Link>

      <MainNav onNavigate={onNavigate} />

      <div className="mt-auto flex flex-col gap-3 border-t pt-4">
        <p className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
          {t('preferences')}
        </p>
        <LocaleSwitcher />
        <ThemeToggle />
        <div className="pt-1">
          <SessionControl />
        </div>
      </div>
    </div>
  );
}
