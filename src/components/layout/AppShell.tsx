import type { ReactNode } from 'react';
import { Announcer } from './Announcer';

/**
 * Landmark structure for the authenticated app (Bölüm 39.2).
 *
 * `<main id="main">` is the skip link's target and the only element that
 * scrolls independently, so long atom lists do not drag the header with them.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Announcer />
      <div className="flex min-h-full flex-col">
        <header className="border-border border-b">
          {/* Navigation lands with the routes it navigates to. */}
        </header>
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
      </div>
    </>
  );
}
