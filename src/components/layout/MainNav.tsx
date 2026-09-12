'use client';

/**
 * The application's two routes.
 *
 * Client-side for one reason: `aria-current="page"` needs to know which route
 * is open, and a nav that does not say where you are is a list of links that
 * looks identical on every screen.
 *
 * It also answers the question the Stage 1 e2e suite never asked. Every test
 * there reached the editor by typing its URL, so nothing noticed that no link
 * led to it — a route reachable only by bookmark is not reachable.
 */

import { useTranslations } from 'next-intl';
import { SessionControl } from '@/components/auth/SessionControl';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Link, usePathname } from '@/lib/i18n/navigation';

/**
 * In the order the product is used: bring a CV, check what came out of it,
 * build something from it.
 *
 * `/onboarding` is listed although § 36.1 calls it a wizard. A route reachable
 * only by typing its URL is not reachable — the same thing this file was
 * written to fix for the editor — and re-importing is a real thing people do,
 * which is why `409 PROFILE_ALREADY_EXISTS` exists at all (`B-060`).
 */
const ROUTES = [
  { href: '/onboarding', key: 'onboarding' },
  { href: '/profile', key: 'profile' },
  { href: '/generate', key: 'generate' },
  // After generating, because that is when there is something to look back
  // at. Listed for everyone rather than only for accounts: the screen says
  // what an anonymous session gets instead, and a link that appears the
  // moment somebody signs in is a feature they never learn exists.
  { href: '/history', key: 'history' },
  // Then where those resumes went (`B-093`). Listed for everyone for the same
  // reason the history is: the screen says what an account gets and an
  // anonymous session does not, and a link that appears the moment somebody
  // signs in is a feature they never learn exists.
  { href: '/applications', key: 'applications' },
  // Last, and listed although most of it is empty: § 57.4 requires deleting
  // an account to be reachable, and a route only a URL reaches is not.
  { href: '/settings', key: 'settings' },
] as const;

export function MainNav() {
  const t = useTranslations('Nav');
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('label')}
      className="mx-auto flex max-w-3xl items-center gap-6 px-8 py-4 text-sm"
    >
      {ROUTES.map(({ href, key }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={
              current ? 'font-medium underline underline-offset-4' : 'text-muted-foreground'
            }
          >
            {t(key)}
          </Link>
        );
      })}

      {/*
        Pushed to the end and set apart from the routes: neither is a place to
        go, and `aria-current` has nothing to say about either.
      */}
      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle />
        <SessionControl />
      </div>
    </nav>
  );
}
