import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AppProviders } from '@/components/providers/AppProviders';

/**
 * Shell for the authenticated application.
 *
 * Providers live here rather than in the root layout on purpose. The landing
 * and legal pages are static marketing surface that fetches nothing, and
 * every kilobyte the app shell adds would otherwise be paid on first contact
 * with the product — the moment where the anonymous funnel is thinnest
 * (Bölüm 12). Keeping them apart also stops the mock worker's startup gate
 * from blanking the landing page in development.
 *
 * The auth guard belongs here too, once sessions exist.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
