import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The shape of what is loading, drawn before it arrives.
 *
 * Hidden from assistive technology: a block of grey says nothing, and the
 * loading state is announced by whoever owns it (a `role="status"` sentence
 * beside it, or the route's `loading.tsx`). Its pulse stops under
 * `prefers-reduced-motion` through the global rule in `globals.css`.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('bg-muted animate-pulse rounded-lg', className)}
      {...props}
    />
  );
}

export { Skeleton };
