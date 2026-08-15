'use client';

import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * Radix gives the keyboard behaviour for free — arrows, Home, End, Page
 * Up/Down — which is the half of rule 5 a hand-rolled drag surface always
 * misses.
 */
type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Spoken value, e.g. "0.6". Without it a screen reader reads the raw number. */
  'aria-valuetext'?: string;
};

/**
 * The naming props go on the **thumb**, not the root.
 *
 * Radix puts `role="slider"` on the thumb, so an `aria-labelledby` left on the
 * root labels a plain `div` and the control itself stays unnamed —
 * and `aria-valuetext` is not even allowed on an element with no role. Both
 * pass axe silently as *props*; only rendering them in the wrong place shows
 * it, which is why this is forwarded here rather than left to each call site.
 */
function Slider({
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-valuetext': ariaValueText,
  ...props
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn('relative flex w-full touch-none items-center select-none', className)}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="bg-muted relative h-1.5 w-full grow overflow-hidden rounded-full"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="bg-primary absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-valuetext={ariaValueText}
        className="border-primary bg-background focus-visible:ring-ring/50 block size-4 shrink-0 rounded-full border-2 transition-all outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
