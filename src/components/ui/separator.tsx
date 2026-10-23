import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A rule between two groups.
 *
 * A plain element rather than Radix's: the only thing Radix adds is the
 * `separator` role toggle, and a decorative line is `role="none"` either way.
 * Server-safe, so the marketing pages can draw one for free.
 */
function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<'div'> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      data-slot="separator"
      role="none"
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
