'use client';

/**
 * Following one job to its end, whichever kind of job it is.
 *
 * The stream and `GET /jobs/{id}` write into **one** cache entry, because
 * they describe one job. The fallback is not a second source of truth; it is
 * the same one, refilled by a different transport when the first stops
 * talking.
 *
 * It lived in `useGeneration` until a second kind of job arrived. Nothing in
 * here was ever about generation: the phases, the terminal payload and the
 * allowance are all the server's, and this only carries them.
 */

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getJob, isTerminal, jobStreamUrl, type JobStatus } from '@/lib/api/endpoints/jobs';
import { accountKeys, jobKeys } from '@/lib/api/queryKeys';

/**
 * What the cache holds for a job. Nothing widens it any more.
 *
 * It carried a loose `result` for a while, because `JobStatusResponse`
 * described only a generation's outcome and an import job's fields had
 * nowhere to go. `B-067` published them — `profileId`, three counts, a
 * detected language and `warnings[]` — so the schema now says what the job
 * says, and the widening came off with the hand-written type in
 * `contracts.ts`.
 */
type CachedJob = JobStatus;

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
      const payload = parse<{ phase?: string; label?: string; pct: number; detail?: string }>(
        event,
      );

      write((current) => ({
        ...current,
        jobId,
        // The server puts no `status` on a phase frame, and no `phase` on
        // the snapshot of a job that has not started moving.
        status: payload.phase ? 'running' : 'queued',
        phase: payload.phase,
        label: payload.label,
        pct: payload.pct,
        detail: payload.detail,
      }));
    });

    source.addEventListener('completed', (event) => {
      const payload = parse<Record<string, unknown>>(event);
      terminal = true;

      // Replaces rather than merges: a completed job has no phase and no
      // label, and carrying the last one forward is how a bar ends up reading
      // 70% beside the word "completed" (`B-038`).
      write(() => ({
        jobId,
        status: 'completed',
        pct: 100,
        // Spread rather than picked: every field a terminal event carries is
        // declared on `JobStatus` now, for both kinds of job, so naming them
        // here would be a second list to keep in step with the schema.
        ...(payload as JobStatus),
      }));

      setTransport({ jobId, mode: 'done' });
      source.close();
      void queryClient.invalidateQueries({ queryKey: accountKeys.usage() });
    });

    source.addEventListener('failed', (event) => {
      const payload = parse<Record<string, unknown>>(event);
      terminal = true;

      // Merged, unlike `completed`: a failed job keeps where it stopped,
      // which is the most useful thing known about it.
      write((current) => ({ ...current, jobId, status: 'failed', error: payload }));

      setTransport({ jobId, mode: 'done' });
      source.close();
      // A failed job gives the allowance back (`B-039`), so the counter has
      // to be read again rather than left showing what was spent.
      void queryClient.invalidateQueries({ queryKey: accountKeys.usage() });
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
