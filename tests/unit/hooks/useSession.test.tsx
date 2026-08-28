import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useCapabilities, useLogout, useSession } from '@/hooks/useSession';
import { profileKeys, sessionKeys } from '@/lib/api/queryKeys';
import { server } from '@/mocks/node';
import { session, signIn } from '@/mocks/sessionFixture';

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe('the session', () => {
  it('starts anonymous, and says what an anonymous caller may do', async () => {
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith(makeClient()) });

    await waitFor(() => expect(result.current.data).toBeDefined());

    const { authenticated, capabilities } = result.current.data!;
    expect(authenticated).toBe(false);
    expect(capabilities.canEditAtomControls).toBe(false);
    expect(capabilities.allowedLanguages).toEqual(['en']);
  });

  /**
   * § 35.7's table, and the half that is easy to get wrong: in an account
   * these two are **absent from the JSON**, not `null`. A screen that reads
   * `maxAtoms` without checking draws a progress bar against a limit that
   * does not exist.
   */
  it('drops maxAtoms and the expiry entirely once there is an account', async () => {
    signIn();
    const { result } = renderHook(() => useCapabilities(), { wrapper: wrapperWith(makeClient()) });

    await waitFor(() => expect(result.current).toBeDefined());

    expect(result.current).not.toHaveProperty('maxAtoms');
    expect(result.current).not.toHaveProperty('anonymousExpiresAt');
    expect(result.current!.canEditAtomControls).toBe(true);
    expect(result.current!.allowedLanguages).toEqual(['en', 'tr']);
  });

  /**
   * The TTL slides with activity (§ 35.7), so the value is only true at the
   * moment it was read. This is the behaviour, not the number: two reads a
   * while apart must not answer with the same instant.
   */
  it('gets a later expiry each time it asks', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(result.current.data).toBeDefined());
    const first = result.current.data!.capabilities.anonymousExpiresAt;

    await new Promise((resolve) => setTimeout(resolve, 20));
    await client.refetchQueries({ queryKey: sessionKeys.all });

    await waitFor(() =>
      expect(Date.parse(result.current.data!.capabilities.anonymousExpiresAt!)).toBeGreaterThan(
        Date.parse(first!),
      ),
    );
  });

  it('is never served from cache', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(result.current.data).toBeDefined());

    // The 30s default exists for the editor's hundreds of atom keys and would
    // freeze a sliding clock for half a minute at a time.
    expect(client.getQueryState(sessionKeys.current())?.isInvalidated).toBe(false);
    expect(result.current.isStale).toBe(true);
  });
});

describe('signing out', () => {
  it('ends the session and comes back anonymous', async () => {
    signIn();
    const client = makeClient();
    const { result } = renderHook(() => ({ session: useSession(), logout: useLogout() }), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.session.data?.authenticated).toBe(true));

    await result.current.logout.mutateAsync();

    // Not "nothing": the endpoint stamps a fresh anonymous session, so the
    // screen underneath is the anonymous product rather than a locked door.
    await waitFor(() => expect(result.current.session.data?.authenticated).toBe(false));
    expect(session.authenticated).toBe(false);
  });

  it('throws away what was fetched as somebody else', async () => {
    signIn();
    const client = makeClient();
    client.setQueryData(profileKeys.head(), { headline: 'the previous person' });

    const { result } = renderHook(() => useLogout(), { wrapper: wrapperWith(client) });
    await result.current.mutateAsync();

    // An invalidation would leave that headline on screen until each query
    // refetched. On a shared machine that is one person's CV shown to the
    // next.
    await waitFor(() => expect(client.getQueryData(profileKeys.head())).toBeUndefined());
  });

  it('is not an error when there was no session', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useLogout(), { wrapper: wrapperWith(client) });

    await expect(result.current.mutateAsync()).resolves.toBeUndefined();
  });

  it('surfaces a refusal rather than pretending it worked', async () => {
    server.use(http.post('*/api/v1/auth/logout', () => new HttpResponse(null, { status: 500 })));

    const client = makeClient();
    const { result } = renderHook(() => useLogout(), { wrapper: wrapperWith(client) });

    await expect(result.current.mutateAsync()).rejects.toThrow();
  });
});
