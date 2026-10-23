import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A `<select>`, styled to sit beside `Input`.
 *
 * Native on purpose. A Radix select would be a popover, a portal and a
 * positioning library on every route that has a dropdown — and on a phone it
 * would replace the platform's own picker, which is the better control there.
 * The nine selects this product had were each styled by hand, three different
 * ways; this is the one way.
 *
 * The chevron is decorative: the element is still a native select, so its
 * role, its keyboard and its label association are the browser's.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className={cn('relative w-full sm:w-fit', className)} data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn(
          'border-input bg-card h-9 w-full appearance-none rounded-lg border py-1 pr-9 pl-3 text-sm transition-all outline-none',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3',
          'disabled:pointer-events-none disabled:opacity-50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </div>
  );
}

export { NativeSelect };
