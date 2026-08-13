import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware replacements for `next/link` and `next/navigation`. Always
 * import navigation helpers from here — the plain Next.js ones drop the
 * locale prefix and send the user to a 404.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
