'use client';

/**
 * The application's routes.
 *
 * Client-side for one reason: `aria-current="page"` needs to know which route
 * is open, and a nav that does not say where you are is a list of links that
 * looks identical on every screen.
 *
 * It also answers the question the Stage 1 e2e suite never asked. Every test
 * there reached the editor by typing its URL, so nothing noticed that no link
 * led to it — a route reachable only by bookmark is not reachable.
 *
 * Drawn twice by `AppShell` — in the desktop sidebar and in the phone's sheet —
 * and never twice at once in the accessibility tree: the sheet's content is not
 * rendered while it is closed, and the sidebar is `display: none` below `lg`.
 */

import { useTranslations } from 'next-intl';
import {
  Briefcase,
  FileStack,
  Settings,
  Sparkles,
  Upload,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * In the order the product is used: bring a CV, check what came out of it,
 * build something from it, then look back at what was built and where it went.
 *
 * `/onboarding` is listed although § 36.1 calls it a wizard. A route reachable
 * only by typing its URL is not reachable, and re-importing is a real thing
 * people do — which is why `409 PROFILE_ALREADY_EXISTS` exists at all
 * (`B-060`). History and applications are listed for everyone: the screens say
 * what an anonymous session gets instead, and a link that appears the moment
 * somebody signs in is a feature they never learn exists. Settings last, and
 * listed although most of it is an account's: § 57.4 requires deleting an
 * account to be reachable.
 */
const ROUTES = [
  { href: '/onboarding', key: 'onboarding', icon: Upload },
  { href: '/profile', key: 'profile', icon: UserRound },
  { href: '/generate', key: 'generate', icon: Sparkles },
  { href: '/history', key: 'history', icon: FileStack },
  { href: '/applications', key: 'applications', icon: Briefcase },
  { href: '/settings', key: 'settings', icon: Settings },
] as const satisfies readonly { href: string; key: string; icon: LucideIcon }[];

export function MainNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('Nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')}>
      <ul className="flex flex-col gap-1">
        {ROUTES.map(({ href, key, icon: Icon }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  current
                    ? 'bg-primary text-primary-foreground shadow-card'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
