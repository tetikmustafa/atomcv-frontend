import { isServer, QueryClient } from '@tanstack/react-query';
import { isRetriable } from './errors';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The profile editor renders hundreds of atoms with granular cache
        // keys (Bölüm 37.7). Without a stale window, expanding a section
        // would refetch every atom it touches.
        staleTime: 30_000,

        // Field-level autosave means the client is often the newest writer.
        // Refetching on every tab switch would fight in-flight optimistic
        // state; conflicts are handled by ETag/412 instead (Bölüm 37.4).
        refetchOnWindowFocus: false,

        // Only network failures and 5xx are worth repeating. A 422 stays a
        // 422, and a 429 is a quota decision the user must actually see
        // rather than something to paper over (Bölüm 44.1).
        retry: (failureCount, error) => failureCount < 2 && isRetriable(error),
      },
      mutations: {
        // Mutations are not idempotent by default. The endpoints that are
        // safe to repeat send an Idempotency-Key and can opt in themselves.
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * One client per request on the server, one shared client in the browser.
 * A module-level client on the server would leak one user's cache into
 * another's response.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
