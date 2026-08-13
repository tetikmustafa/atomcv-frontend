import { isServer, QueryClient } from '@tanstack/react-query';

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

        // Deliberately off until the API client lands and errors carry a
        // status. Retrying a 422/409/429 is pointless — those answers are
        // deterministic — so a blanket retry is worse than none.
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
