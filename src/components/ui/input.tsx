import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The single-line counterpart to `Textarea`, sharing its classes so the two
 * cannot drift apart in a form that uses both.
 *
 * Written rather than pulled from shadcn's registry: the generated one carries
 * `file:` and `selection:` variants for a file input this project has no use
 * for yet, and matching `Textarea` exactly matters more than matching upstream.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'border-border bg-background placeholder:text-muted-foreground h-9 w-full rounded-lg border px-3 text-sm transition-all outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3',
        'disabled:pointer-events-none disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
