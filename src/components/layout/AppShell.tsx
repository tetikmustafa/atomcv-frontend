import type { ReactNode } from 'react';
import { SessionNotice } from '@/components/session/SessionNotice';
import { Announcer } from './Announcer';
import { MainNav } from './MainNav';

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
          <MainNav />
        </header>
        {/*
          Outside `<main>`, because it is about the session rather than about
          the page — and inside the scrolling region it would be a warning the
          reader scrolls past on the one screen where they were working.
        */}
        <SessionNotice />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
      </div>
    </>
  );
}
