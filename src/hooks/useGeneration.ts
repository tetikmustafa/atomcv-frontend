'use client';

/**
 * Starting a generation, and following it until it ends.
 *
 * The stream and `GET /jobs/{id}` write into **one** cache entry, because
 * they describe one job. The fallback is not a second source of truth; it is
 * the same one, refilled by a different transport when the first stops
 * talking.
 *
 * Two things here exist only because the wire behaves the way it was measured
 * to, and both would be invisible in a document:
 *
 * - **An empty `label` is not a translation key.** The snapshot frame carries
 *   empty strings rather than dropping the fields (`F-010`), so resolving it
 *   blindly would put `generation.phase.` in front of the user, on the line
 *   they look at most.
 * - **`pageCount` only ever arrives on the stream.** `GET /jobs/{id}` does not
 *   carry it, so a job reconciled by the fallback has a result and no page
 *   count. The screen has to survive that rather than assume it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  downloadGeneration,
  startGeneration,
  type GenerationRequest,
} from '@/lib/api/endpoints/generations';
import { getJob, isTerminal, jobStreamUrl, type JobStatus } from '@/lib/api/endpoints/jobs';
import { getUsage, type Usage } from '@/lib/api/endpoints/account';
import { accountKeys, jobKeys } from '@/lib/api/queryKeys';

/**
 * `JobStatus` plus the one field the stream knows and the status endpoint
 * does not. Widened here rather than in `endpoints/jobs.ts`: it is not part
 * of that response, and pretending otherwise would hide `F-008`.
 */
type CachedJob = JobStatus & { pageCount?: number };

type Transport = 'stream' | 'poll' | 'done';

/** How often the fallback asks, once the stream has stopped answering. */
const POLL_INTERVAL = 1_500;

export type JobProgress = {
  status: NonNullable<JobStatus['status']>;
  /** `generation.phase.*`, or `null` while there is no phase to name. */
  phaseKey: string | null;
  pct: number;
  detail: string | null;
  generationId: string | null;
  /** `null` when the stream was not the transport that delivered the result. */
  pageCount: number | null;
  /** The `failed` payload, in the shape `toErrorLike` reads. */
  failure: unknown | null;
  /** True once the job has stopped moving, either way. */
  done: boolean;
};

/**
 * Starts a generation and hands back the accepted job.
 *
 * The `Idempotency-Key` is per **attempt the user meant**, not per call: it
 * survives a failed request so that clicking again after a dropped
 * connection collapses into the job the server already made, and it is
 * dropped when the body changes or the request succeeds — asking again for
 * the same posting, having seen the result, is a second generation and must
 * be treated as one.
 */
export function useStartGeneration() {
  const attempt = useRef<{ body: string; key: string } | null>(null);

  const keyFor = useCallback((body: GenerationRequest) => {
    const serialized = JSON.stringify(body);
    if (attempt.current?.body !== serialized) {
      attempt.current = { body: serialized, key: crypto.randomUUID() };
    }
    return attempt.current.key;
  }, []);

  return useMutation({
    mutationFn: (body: GenerationRequest) => startGeneration(body, keyFor(body)),
    onSuccess: () => {
      attempt.current = null;
    },
  });
}

/**
 * Follows one job to its end.
 *
 * Takes a job id rather than allowing `null`, so the caller mounts it only
 * when there is something to follow. A hook that spends most of its life
 * disabled has to invent a cache key for the disabled case, and that key is a
 * place for a stale job to hide.
 */
export function useJobStream(jobId: string, streamUrl?: string): JobProgress {
  const queryClient = useQueryClient();
  // `stream` until it stops talking, then `poll` — the documented fallback —
  // and `done` once a terminal event has arrived and neither transport has
  // anything left to do.
  //
  // Stored with the job it belongs to and read back through it, rather than
  // reset by an effect when `jobId` changes. An effect that reset it would
  // run *after* a render in which a new job was already showing the previous
  // job's transport, and "done" is the state that renders a result.
  const [chosen, setTransport] = useState<{ jobId: string; mode: Transport }>({
    jobId,
    mode: 'stream',
  });
  const transport = chosen.jobId === jobId ? chosen.mode : 'stream';

  const { data } = useQuery<CachedJob>({
    queryKey: jobKeys.status(jobId),
    queryFn: () => getJob(jobId),
    // The stream sends the current state on connect, so asking as well would
    // be a second request for something already on its way.
    enabled: transport === 'poll',
    refetchInterval: (query) => (isTerminal(query.state.data) ? false : POLL_INTERVAL),
  });

  useEffect(() => {
    const source = new EventSource(streamUrl ?? jobStreamUrl(jobId));
    let terminal = false;

    const write = (next: (current: CachedJob | undefined) => CachedJob) =>
      queryClient.setQueryData<CachedJob>(jobKeys.status(jobId), next);

    const parse = <T>(event: Event) => JSON.parse((event as MessageEvent<string>).data) as T;

    source.addEventListener('phase', (event) => {
      const payload = parse<{ phase: string; label: string; pct: number; detail: string }>(event);

      write((current) => ({
        ...current,
        jobId,
        // The server does not put `status` on a phase frame; an empty phase
        // is the snapshot of a job that has not started moving.
        status: payload.phase === '' ? 'queued' : 'running',
        phase: payload.phase,
        label: payload.label,
        pct: payload.pct,
        detail: payload.detail,
      }));
    });

    source.addEventListener('completed', (event) => {
      const payload = parse<{ generationId: string; pageCount: number }>(event);
      terminal = true;

      // Replaces rather than merges: a completed job has no phase and no
      // label, and carrying the last one forward is how a bar ends up reading
      // 70% beside the word "completed" (`B-038`).
      write(() => ({
        jobId,
        status: 'completed',
        pct: 100,
        generationId: payload.generationId,
        pageCount: payload.pageCount,
      }));

      setTransport({ jobId, mode: 'done' });
      source.close();
    });

    source.addEventListener('failed', (event) => {
      const payload = parse<Record<string, unknown>>(event);
      terminal = true;

      // Merged, unlike `completed`: a failed job keeps where it stopped,
      // which is the most useful thing known about it.
      write((current) => ({ ...current, jobId, status: 'failed', error: payload }));

      setTransport({ jobId, mode: 'done' });
      source.close();
    });

    source.onerror = () => {
      // A stream that ends after its terminal event has ended correctly.
      // `EventSource` reports the closed connection as an error and would
      // reconnect on its own, which is why this closes it rather than
      // leaving it to reopen a stream with nothing left to say.
      if (terminal) return;

      source.close();
      setTransport({ jobId, mode: 'poll' });
    };

    return () => source.close();
  }, [jobId, streamUrl, queryClient]);

  // Nothing switches `poll` off: `refetchInterval` already stops asking once
  // the answer is terminal, and a second piece of state saying the same thing
  // is a second thing to keep true.
  return toProgress(data);
}

function toProgress(job: CachedJob | undefined): JobProgress {
  const status = job?.status ?? 'queued';

  return {
    status,
    // The single place an empty label is turned into an absent one.
    phaseKey: job?.label ? job.label : null,
    pct: job?.pct ?? 0,
    detail: job?.detail ? job.detail : null,
    generationId: job?.generationId ?? null,
    pageCount: job?.pageCount ?? null,
    failure: job?.error ?? null,
    done: status === 'completed' || status === 'failed' || status === 'cancelled',
  };
}

/**
 * The finished document.
 *
 * A mutation rather than a query: downloading is something the user does, it
 * is answered `no-store`, and caching a blob whose only use is to be saved
 * once would keep it in memory for nothing.
 */
export function useDownloadGeneration() {
  return useMutation({ mutationFn: (generationId: string) => downloadGeneration(generationId) });
}

/**
 * Today's usage against today's limits.
 *
 * Both metrics always arrive, so the screen indexes by name rather than by
 * position — a missing entry would mean the metric does not exist, and there
 * is no such state (`B-039`).
 */
export function useUsage() {
  return useQuery<Usage[]>({ queryKey: accountKeys.usage(), queryFn: getUsage });
}

/**
 * How many pages a finished generation came to, when this session watched it
 * happen.
 *
 * Reads the job cache rather than asking, because there is nothing to ask:
 * `pageCount` rides the `completed` event and no endpoint carries it
 * (`F-008`). A result reached by reload, or reconciled through the polling
 * fallback, has no page count — hence `null` rather than a guess, and a
 * screen that leaves the sentence out rather than filling it in.
 *
 * A plain cache read, not a subscription: the job is terminal by the time
 * this renders, so there is no later value to re-render for.
 */
export function useJobPageCount(generationId: string): number | null {
  const queryClient = useQueryClient();

  const watched = queryClient
    .getQueriesData<CachedJob>({ queryKey: jobKeys.all })
    .find(([, job]) => job?.generationId === generationId);

  return watched?.[1]?.pageCount ?? null;
}
