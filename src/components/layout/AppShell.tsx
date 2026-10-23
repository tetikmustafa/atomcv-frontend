import type { ReactNode } from 'react';
import { SessionNotice } from '@/components/session/SessionNotice';
import { Announcer } from './Announcer';
import { AppSidebar } from './AppSidebar';
import { MobileNav } from './MobileNav';
import { SiteFooter } from './SiteFooter';

/**
 * Landmark structure for the app (Bölüm 39.2).
 *
 * A sidebar from `lg` up, a header with a sheet below it. The sidebar is
 * sticky and the page scrolls beside it, so a long profile never drags the
 * navigation off screen; on a phone the header is sticky for the same reason.
 *
 * `<main id="main">` is the skip link's target. The footer sits in the content
 * column rather than under the whole window, so it never runs beneath the
 * sidebar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Announcer />
      <div className="flex min-h-dvh">
        <aside className="bg-card sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto border-r px-4 py-6 lg:block">
          <AppSidebar />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur lg:hidden">
            <MobileNav />
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
          <SiteFooter />
        </div>
      </div>
    </>
  );
}
