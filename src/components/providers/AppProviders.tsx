'use client';

import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { setSessionRecovery } from '@/lib/api/client';
import { getSession, type Session } from '@/lib/api/endpoints/auth';
import { getQueryClient } from '@/lib/api/queryClient';
import { sessionKeys } from '@/lib/api/queryKeys';
import { MockProvider } from './MockProvider';

/**
 * Client-side providers for the whole app.
 *
 * Zustand needs no provider — its stores are module singletons. Only server
 * state gets one, which is the point: server data lives here, never in a
 * client store.
 *
 * MockProvider sits outermost so the worker is intercepting before any query
 * can fire.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  // Registered at render rather than in an effect: a child's mount effect can
  // already be sending the write that needs it. `client.ts` says when it runs.
  setSessionRecovery(async (reason) => {
    const known = queryClient.getQueryData<Session>(sessionKeys.current());
    if (reason === 'session' && known?.authenticated) return false;

    const fresh = await queryClient.fetchQuery({
      queryKey: sessionKeys.current(),
      queryFn: getSession,
      staleTime: 0,
    });
    return reason === 'token' || !fresh.authenticated;
  });

  return (
    <MockProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MockProvider>
  );
}
