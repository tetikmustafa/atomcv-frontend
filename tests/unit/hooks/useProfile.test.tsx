import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAtom, useAtoms, usePatchAtom, usePatchVariant } from '@/hooks/useProfile';
import { profileKeys } from '@/lib/api/queryKeys';
import { patchAtom, type Atom } from '@/lib/api/endpoints/profile';
import { isApiError } from '@/lib/api/errors';
import { fixture } from '@/mocks/profileFixture';
import { server } from '@/mocks/node';
import { signIn } from '@/mocks/sessionFixture';

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
   * `spec/08-api.md` removed `GET /profile/atoms/{id}`, so the collection response is
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
  /*
    As an account, because `importance` is one of the four controls
    § 35.7.2 keeps for one (`B-081`): an anonymous patch carrying it is
    refused whole, and what these check is the cache write-through rather than
    the gate.
  */
  beforeEach(signIn);

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

describe('promoting a wording', () => {
  /**
   * Seeded straight into the cache rather than through `useAtoms`, and the
   * difference matters: a rendered collection is an observer, so the
   * invalidation at the end of `onSuccess` would refetch and re-seed the
   * versions from the server. That refetch is the thing this test has to
   * exclude — it repairs a missing bump, and would make the assertion pass
   * whether or not the optimistic copy did its job.
   *
   * Cloned for the same reason: the handler mutates the fixture in place, and
   * a cache holding the fixture's own object would be updated by the very
   * write it is supposed to be checking.
   */
  function seed(client: QueryClient, id: string) {
    const atom = fixture.atoms.find((candidate) => candidate.id === id)!;
    client.setQueryData(profileKeys.atom(id), structuredClone(atom));
  }

  /**
   * ⚠️ B-034. Promotion demotes the other wording, and since `F-001` closed
   * the server versions that row too. The local demote has to move with it:
   * a cache left one version behind holds an etag that is already spent, and
   * the next edit to that wording — still on screen — comes back 412.
   *
   * The window is only as long as the invalidation takes, which is why this
   * is worth pinning rather than leaving to a passing screen.
   */
  it('bumps the version of the wording it demotes', async () => {
    const client = makeClient();
    seed(client, 'atom-2');

    const { result } = renderHook(() => usePatchVariant(), { wrapper: wrapperFor(client) });

    result.current.mutate({
      atomId: 'atom-2',
      variantId: 'variant-2-tr',
      body: { primary: true },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<Atom>(profileKeys.atom('atom-2'));
    const byId = (id: string) => cached?.variants?.find((variant) => variant.id === id);

    expect(byId('variant-2')?.primary).toBe(false);
    expect(byId('variant-2')?.version).toBe(1);

    // The promoted row takes the server's own version, not a guess.
    expect(byId('variant-2-tr')?.primary).toBe(true);
    expect(byId('variant-2-tr')?.version).toBe(1);
  });

  /**
   * The other half of B-034, and the reason "bump them all" is not the fix:
   * wordings that took no part in the promotion are not versioned server-side,
   * so raising them here would spend etags that are still good and turn the
   * next legitimate edit into a conflict.
   */
  it('leaves the versions of uninvolved wordings alone', async () => {
    const client = makeClient();
    seed(client, 'atom-1');

    const before = client.getQueryData<Atom>(profileKeys.atom('atom-1'));
    expect(before?.variants).toHaveLength(1);

    const { result } = renderHook(() => usePatchVariant(), { wrapper: wrapperFor(client) });

    // Promoting the one that is already primary: there is nothing to demote,
    // so nothing else may move.
    result.current.mutate({ atomId: 'atom-1', variantId: 'variant-1', body: { primary: true } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<Atom>(profileKeys.atom('atom-1'));
    expect(cached?.variants?.[0]?.version).toBe(1);
    expect(cached?.variants?.[0]?.primary).toBe(true);
  });

  /**
   * What the stale etag actually costs, measured rather than reasoned about:
   * the write that follows a promote must be accepted. Before the bump it
   * quoted `"0"` for a row the server had already moved to `1`.
   */
  it('lets the demoted wording be edited straight afterwards', async () => {
    const client = makeClient();
    seed(client, 'atom-2');

    const { result } = renderHook(() => usePatchVariant(), { wrapper: wrapperFor(client) });

    result.current.mutate({
      atomId: 'atom-2',
      variantId: 'variant-2-tr',
      body: { primary: true },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    result.current.mutate({
      atomId: 'atom-2',
      variantId: 'variant-2',
      body: { content: { v: 1, runs: [{ t: 'Edited right after the demote', m: [] }] } },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isError).toBe(false);
  });
});
