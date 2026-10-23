import { APP_NAME } from '@/lib/seo';
import { cn } from '@/lib/utils';

/**
 * The mark and the name.
 *
 * The mark is an atom drawn as three stacked lines of a page — the product's
 * idea in one glyph: a CV assembled from parts. Inline SVG in
 * `currentColor`, so it follows the theme and costs no request. Decorative:
 * the name beside it is what a screen reader reads, and where the name is
 * hidden (`markOnly`) the caller's link carries an accessible name instead.
 *
 * Server-safe — the marketing header and the app header both draw it.
 */
export function Logo({ className, markOnly = false }: { className?: string; markOnly?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden="true" focusable="false">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
        <rect x="6.5" y="7" width="11" height="2" rx="1" className="fill-background" />
        <rect x="6.5" y="11" width="8" height="2" rx="1" className="fill-background" />
        <rect x="6.5" y="15" width="5" height="2" rx="1" className="fill-background" />
      </svg>
      {!markOnly && <span>{APP_NAME}</span>}
    </span>
  );
}
