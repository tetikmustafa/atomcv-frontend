import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAtom, useAtoms, usePatchAtom } from '@/hooks/useProfile';
import { profileKeys } from '@/lib/api/queryKeys';
import { patchAtom, type Atom } from '@/lib/api/endpoints/profile';
import { isApiError } from '@/lib/api/errors';
import { server } from '@/mocks/node';

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** Counts collection reads, which is what "never refetches all 200" means. */
let atomListRequests = 0;

function countAtomList({ request }: { request: Request }) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname.endsWith('/profile/atoms')) atomListRequests += 1;
}

beforeEach(() => {
  atomListRequests = 0;
  server.events.on('request:start', countAtomList);
});

afterEach(() => {
  server.events.removeListener('request:start', countAtomList);
});

describe('the atom cache', () => {
  /**
   * EK D.6 removed `GET /profile/atoms/{id}`, so the collection response is
   * the only place a per-atom version ever appears. Seeding is what lets the
   * editor hold 200 atoms and still build an `If-Match` for any one of them.
   */
  it('is seeded per atom by the collection that carries their versions', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useAtoms(), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const seeded = client.getQueryData<Atom>(profileKeys.atom('atom-1'));

    expect(seeded?.id).toBe('atom-1');
    expect(seeded?.version).toBe(0);
  });

  it('serves a single atom from that seed without a request of its own', async () => {
    const client = makeClient();
    const wrapper = wrapperFor(client);

    const collection = renderHook(() => useAtoms(), { wrapper });
    await waitFor(() => expect(collection.result.current.isSuccess).toBe(true));

    const single = renderHook(() => useAtom('atom-1'), { wrapper });
    await waitFor(() => expect(single.result.current.isSuccess).toBe(true));

    expect(single.result.current.data?.id).toBe('atom-1');
    expect(atomListRequests).toBe(1);
  });

  /**
   * Asking for an atom nobody loaded is a wiring bug, and there is no request
   * that could rescue it. It has to say that rather than hang.
   */
  it('reports a missing seed instead of trying to fetch one atom', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useAtom('atom-never-loaded'), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/no .*single-atom endpoint/);
  });
});

describe('writing an atom', () => {
  it('updates both caches from the response, without refetching the collection', async () => {
    const client = makeClient();
    const wrapper = wrapperFor(client);

    const collection = renderHook(() => useAtoms(), { wrapper });
    await waitFor(() => expect(collection.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => usePatchAtom(), { wrapper });
    // No version passed: it is read from the cache, which every write keeps
    // current. A version threaded through the caller is one read at some
    // render, and stale by the second save.
    result.current.mutate({ id: 'atom-1', patch: { importance: 0.9 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The server's copy, carrying the version the next write must quote.
    expect(client.getQueryData<Atom>(profileKeys.atom('atom-1'))?.version).toBe(1);
    expect(
      client.getQueryData<Atom[]>(profileKeys.atoms())?.find((atom) => atom.id === 'atom-1')
        ?.importance,
    ).toBe(0.9);

    // One read, at the start. Learning one atom's new version must not cost
    // a re-read of every atom.
    expect(atomListRequests).toBe(1);
  });

  /**
   * The version is read from the cache when the request is built, which is
   * after the optimistic write has already touched that entry. So the
   * optimistic write must leave `version` alone — if it ever bumped it, every
   * save after the first would quote a version the server has not issued and
   * conflict against nobody.
   */
  it('leaves the version untouched while the change is still optimistic', async () => {
    const client = makeClient();
    const wrapper = wrapperFor(client);

    const collection = renderHook(() => useAtoms(), { wrapper });
    await waitFor(() => expect(collection.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => usePatchAtom(), { wrapper });

    let optimistic: Atom | undefined;
    client.getQueryCache().subscribe(() => {
      optimistic ??= client.getQueryData<Atom>(profileKeys.atom('atom-1'));
    });

    result.current.mutate({ id: 'atom-1', patch: { importance: 0.9 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(optimistic?.importance).toBe(0.9);
    expect(optimistic?.version).toBe(0);
  });

  /**
   * A slider that waits for a round trip feels broken (Bölüm 37.2), so the
   * change lands first — and has to be taken back cleanly when the write is
   * refused, version included, or the next attempt fails too.
   */
  it('applies the change immediately and rolls it back on a conflict', async () => {
    const client = makeClient();
    const wrapper = wrapperFor(client);

    const collection = renderHook(() => useAtoms(), { wrapper });
    await waitFor(() => expect(collection.result.current.isSuccess).toBe(true));

    // Somebody else writes — another tab, or the same profile in another
    // window. The server moves on; this client's cache does not hear about it.
    await patchAtom('atom-1', { importance: 0.75 }, 0);

    const { result } = renderHook(() => usePatchAtom(), { wrapper });
    result.current.mutate({ id: 'atom-1', patch: { importance: 0.1 } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isApiError(result.current.error) && result.current.error.code).toBe('VERSION_CONFLICT');

    const restored = client.getQueryData<Atom>(profileKeys.atom('atom-1'));
    expect(restored?.importance).toBe(0.6);
    expect(restored?.version).toBe(0);
  });
});
