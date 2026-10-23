'use client';

/**
 * A panel that slides in from an edge — the phone's navigation.
 *
 * Radix's Dialog underneath: focus is trapped while it is open, Escape and the
 * overlay close it, and focus returns to the button that opened it. Its
 * content is **not rendered** while closed, which is what lets the desktop
 * navigation and this one share link names without a page ever holding two
 * of each.
 */

import * as React from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

function SheetContent({
  className,
  children,
  side = 'right',
  closeLabel,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'left' | 'right';
  /** The close button's name, in the reader's language. */
  closeLabel: string;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'bg-card shadow-raised fixed inset-y-0 z-50 flex w-[85vw] max-w-xs flex-col gap-4 p-5',
          'data-[state=open]:animate-in data-[state=closed]:animate-out duration-200',
          side === 'right'
            ? 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right right-0 border-l'
            : 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left left-0 border-r',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className="text-muted-foreground hover:text-foreground hover:bg-muted absolute top-4 right-4 rounded-md p-1.5"
          aria-label={closeLabel}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-base font-semibold', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
