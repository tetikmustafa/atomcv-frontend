'use client';

import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/api/queryClient';
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

  return (
    <MockProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MockProvider>
  );
}
