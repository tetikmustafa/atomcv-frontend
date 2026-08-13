'use client';

import { useAnnouncerStore } from '@/stores/announcerStore';

/**
 * The app-wide live region. Rendered once, high in the tree, and never
 * conditionally — a live region that is inserted at the moment it has
 * something to say is frequently not announced at all, because assistive
 * technology has to be observing the node before its content changes.
 *
 * Two regions rather than one: an element's `aria-live` value is read when
 * the change happens, so swapping the attribute on a shared node races with
 * the announcement itself.
 */
export function Announcer() {
  const announcement = useAnnouncerStore((state) => state.announcement);

  const polite = announcement?.urgency === 'polite' ? announcement : null;
  const assertive = announcement?.urgency === 'assertive' ? announcement : null;

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {polite?.message ?? ''}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive?.message ?? ''}
      </div>
    </>
  );
}
