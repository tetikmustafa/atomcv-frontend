import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The one surface content sits on.
 *
 * Every screen used to draw its own `rounded-md border p-4` — and some
 * `rounded-lg`, some without padding — so two panels side by side rarely
 * matched. A card is white on the off-white page in light and a step lighter
 * than the page in dark: depth instead of colour, which is the whole of the
 * monochrome direction.
 *
 * Server-safe (no `'use client'`): the marketing pages use it and ship no
 * JavaScript of their own.
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground shadow-card flex flex-col gap-5 rounded-xl border p-5 sm:p-6',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}
      {...props}
    />
  );
}

/**
 * A heading, not a styled div: a card's title is the name of a section of the
 * page, and a screen reader's heading list is how somebody finds it. The level
 * is the caller's, because only the page knows its own outline.
 */
function CardTitle({
  className,
  as: Heading = 'h2',
  ...props
}: React.ComponentProps<'h2'> & { as?: 'h2' | 'h3' | 'h4' }) {
  return (
    <Heading
      data-slot="card-title"
      className={cn('text-base leading-snug font-semibold', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('flex flex-col gap-4', className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex flex-wrap items-center gap-2 border-t pt-4', className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
