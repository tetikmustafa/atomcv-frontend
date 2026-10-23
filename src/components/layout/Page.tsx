import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The width and gutters every screen shares.
 *
 * Every page used to be `max-w-3xl px-8`: on a 375px phone that left 311px
 * for content and nothing for a gutter that grows on a wide screen. One
 * component now owns the measure, with a gutter that starts at 16px and widens
 * at each breakpoint.
 *
 * Two widths, and the reason is reading rather than taste: a form or an
 * article reads best at about 70 characters (`narrow`), a list of cards or a
 * two-column screen needs the room (`wide`).
 */
export function Page({
  children,
  width = 'wide',
  className,
}: {
  children: ReactNode;
  width?: 'narrow' | 'wide';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:px-8',
        width === 'narrow' ? 'max-w-3xl' : 'max-w-5xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The page's one `h1`, what it is for, and what you can do from here.
 *
 * Actions sit to the right on a wide screen and below on a narrow one, so a
 * button never squeezes the title into three lines.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  titleId,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** A short label above the title — the step, or the section of the product. */
  eyebrow?: ReactNode;
  titleId?: string;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && (
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {eyebrow}
          </p>
        )}
        <h1 id={titleId} className="text-2xl font-semibold sm:text-3xl">
          {title}
        </h1>
        {description && (
          <div className="text-muted-foreground max-w-prose text-sm sm:text-base">
            {description}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
