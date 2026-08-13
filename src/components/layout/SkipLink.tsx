import { useTranslations } from 'next-intl';

/**
 * Lets keyboard and screen-reader users jump past the header straight to the
 * page content (Bölüm 39.2).
 *
 * Visually hidden until focused rather than removed from the layout — a link
 * behind `display: none` is not reachable by the Tab key at all, which is the
 * usual way this control ends up decorative.
 */
export function SkipLink() {
  const t = useTranslations('A11y');

  return (
    <a
      href="#main"
      className="bg-background text-foreground focus-visible:ring-ring sr-only rounded-md px-4 py-2 focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:ring-2"
    >
      {t('skipToContent')}
    </a>
  );
}
