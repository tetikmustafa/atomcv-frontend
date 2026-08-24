import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useJobStream, useStartGeneration } from '@/hooks/useGeneration';
import { jobKeys } from '@/lib/api/queryKeys';
import { toErrorLike } from '@/lib/errors/errorLike';
import { generations, failNextJob, pauseGeneration } from '@/mocks/generationFixture';
import { server } from '@/mocks/node';
import { dropStreamAfter } from '../../support/eventSource';

/**
 * One client per test, built in `beforeEach`.
 *
 * Not one per render: `wrapper` is a component, so building it in the body
 * hands every render a fresh cache and every mutation forgets what it just
 * did — which looks exactly like a hook that never resolved.
 */
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Every `Idempotency-Key` the client sent, in order. */
let keys: (string | null)[] = [];

function captureKeys({ request }: { request: Request }) {
  if (request.method === 'POST' && request.url.endsWith('/generations')) {
    keys.push(request.headers.get('Idempotency-Key'));
  }
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  keys = [];
  server.events.on('request:start', captureKeys);
});

afterEach(() => {
  server.events.removeListener('request:start', captureKeys);
});

async function startJob() {
  const { result } = renderHook(() => useStartGeneration(), { wrapper });
  let job: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;

  await act(async () => {
    job = await result.current.mutateAsync({ acknowledgePreflight: false });
  });

  return job!;
}

describe('following a job', () => {
  it('reads a queued snapshot as having no phase to name', async () => {
    const job = await startJob();

    const { result } = renderHook(() => useJobStream(job.jobId!, job.streamUrl), { wrapper });

    // Waits for the frame, not for the reading: `status` defaults to
    // `queued` and `phaseKey` to `null` before anything has arrived, so
    // asserting those first would pass against an empty cache and prove
    // nothing about the snapshot at all.
    await waitFor(() => expect(client.getQueryData(jobKeys.status(job.jobId!))).toBeDefined());

    // The frame carries `label: ''` (`F-010`). An empty string is not a
    // translation key, and resolving it would put `generation.phase.` on the
    // most-read line in the product.
    expect(result.current.status).toBe('queued');
    expect(result.current.phaseKey).toBeNull();
    expect(result.current.pct).toBe(0);
  });

  it('names each phase with the key the server sent', async () => {
    const job = await startJob();

    const { result } = renderHook(() => useJobStream(job.jobId!, job.streamUrl), { wrapper });

    await waitFor(() => expect(result.current.phaseKey).toBe('generation.phase.ANALYSING'));
    expect(result.current.status).toBe('running');
    expect(result.current.pct).toBe(10);
  });

  it('ends on the terminal event, with no phase left over', async () => {
    const job = await startJob();

    const { result } = renderHook(() => useJobStream(job.jobId!, job.streamUrl), { wrapper });

    await waitFor(() => expect(result.current.done).toBe(true), { timeout: 5_000 });

    expect(result.current.status).toBe('completed');
    expect(result.current.generationId).toBeTruthy();
    expect(result.current.pageCount).toBe(1);
    // A bar reading 70% beside the word "completed" is worse than no bar.
    expect(result.current.pct).toBe(100);
    expect(result.current.phaseKey).toBeNull();
  });

  it('hands a failure to the same renderer a 4xx would reach', async () => {
    failNextJob();
    const job = await startJob();

    const { result } = renderHook(() => useJobStream(job.jobId!, job.streamUrl), { wrapper });

    await waitFor(() => expect(result.current.done).toBe(true), { timeout: 5_000 });

    expect(result.current.status).toBe('failed');
    // Not 100: a failed job keeps where it stopped, and that is the most
    // useful thing known about it.
    expect(result.current.pct).toBe(70);

    const rendered = toErrorLike(result.current.failure);
    expect(rendered.code).toBe('COMPILATION_FAILED');
    expect(rendered.resolutions.map((resolution) => resolution.action)).toEqual(['retry']);
  });

  it('reconciles through the status endpoint when the stream stops talking', async () => {
    const job = await startJob();
    // Two frames, then nothing — a proxy that timed out, a worker that died.
    // Indistinguishable from a stuck generation, which is why the fallback
    // exists at all.
    dropStreamAfter(2);

    const { result } = renderHook(() => useJobStream(job.jobId!, job.streamUrl), { wrapper });

    await waitFor(() => expect(result.current.done).toBe(true), { timeout: 8_000 });

    expect(result.current.status).toBe('completed');
    expect(result.current.generationId).toBeTruthy();
    // `pageCount` used to ride the stream alone, so a job reconciled this way
    // arrived without one. `B-041` put it on `GET /jobs/{id}` as well, and
    // the two transports now agree about the whole result rather than about
    // most of it.
    expect(result.current.pageCount).toBe(1);
  });
});

describe('the double-submit defence', () => {
  it('reuses the key when the same request is tried again after a failure', async () => {
    pauseGeneration();

    const { result } = renderHook(() => useStartGeneration(), { wrapper });
    const body = { acknowledgePreflight: false };

    await act(async () => {
      await result.current.mutateAsync(body).catch(() => undefined);
    });

    pauseGeneration(false);

    await act(async () => {
      await result.current.mutateAsync(body);
    });

    // One key for one thing the user meant. Without this, the click after a
    // dropped connection is a second CV.
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(generations.jobs).toHaveLength(1);
  });

  it('asks again with a new key once the first one produced a job', async () => {
    const { result } = renderHook(() => useStartGeneration(), { wrapper });
    const body = { acknowledgePreflight: false };

    await act(async () => {
      await result.current.mutateAsync(body);
    });
    await act(async () => {
      await result.current.mutateAsync(body);
    });

    // Asking for the same posting again, having seen the result, is a second
    // generation — reusing the key would answer with the first one.
    expect(keys[0]).not.toBe(keys[1]);
    expect(generations.jobs).toHaveLength(2);
  });
});
