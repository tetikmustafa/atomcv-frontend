'use client';

/**
 * The one control that changes who you are: sign in, or sign out.
 *
 * It draws nothing until the session has answered. The two states are
 * mutually exclusive claims about the reader, and guessing one for a few
 * hundred milliseconds means either offering an account holder a way in they
 * do not need, or telling somebody signed in that they are not — the second
 * of which is clickable before it corrects itself.
 *
 * Signing out was wired up in the previous slice and deliberately left
 * without a button (`B-046`): nobody could sign in yet, so it would have been
 * the control for an unreachable state. It arrives here with the way in.
 */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useLogout, useSession } from '@/hooks/useSession';
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation';

export function SessionControl() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const signOut = useLogout();

  if (!session) return null;

  if (!session.authenticated) {
    // The path without its locale prefix, which is exactly the shape `next`
    // travels in — `usePathname` from next-intl strips it, and
    // `safeReturnPath` would strip it again if it did not.
    const next = new URLSearchParams({ next: pathname });

    return (
      <Link href={`/login?${next}`} className="text-muted-foreground">
        {t('signIn')}
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={signOut.isPending}
      onClick={() =>
        signOut.mutate(undefined, {
          // Home rather than where they stood. Every screen in the app is
          // about the caller's own profile, and the caller is now somebody
          // else — a fresh anonymous session with an empty profile (§ 35.7).
          // Staying put would show that emptiness where their work had been
          // a moment earlier, which reads as data loss rather than as a sign-out.
          onSuccess: () => router.replace('/'),
        })
      }
    >
      {t('signOut')}
    </Button>
  );
}
