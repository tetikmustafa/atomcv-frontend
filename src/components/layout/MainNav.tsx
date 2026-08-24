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
import { Link, usePathname } from '@/lib/i18n/navigation';

const ROUTES = [
  { href: '/profile', key: 'profile' },
  { href: '/generate', key: 'generate' },
] as const;

export function MainNav() {
  const t = useTranslations('Nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')} className="mx-auto flex max-w-3xl gap-6 px-8 py-4 text-sm">
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
    </nav>
  );
}
