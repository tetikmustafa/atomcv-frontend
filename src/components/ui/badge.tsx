import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * A short fact next to the thing it is about — a status, a count, a label.
 *
 * Never the only carrier of meaning (rule 6): every badge's text says what
 * its shade only hints at, so it reads the same in high contrast, in print and
 * to a screen reader. The solid and outline shades are both foreground on
 * background pairs the palette test already measures; `destructive` is the
 * error-panel tint.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border-transparent',
        secondary: 'bg-secondary text-secondary-foreground border-transparent',
        outline: 'text-foreground bg-card',
        muted: 'bg-muted text-muted-foreground border-transparent',
        destructive: 'border-destructive/30 text-destructive bg-card',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
