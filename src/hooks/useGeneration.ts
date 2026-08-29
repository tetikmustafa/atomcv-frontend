'use client';

/**
 * Starting a generation, and reading back what it made.
 *
 * Following the job itself is `useJob`, which moved out of here when profile
 * import became the second thing that queues one. Nothing about waiting on a
 * job was ever specific to generation.
 */

import { useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  downloadGeneration,
  getGeneration,
  listGenerations,
  regenerateCoverLetter,
  startGeneration,
  submitFeedback,
  type CoverLetterRequest,
  type FeedbackRequest,
  type Generation,
  type GenerationRequest,
} from '@/lib/api/endpoints/generations';
import { getUsage, type Usage } from '@/lib/api/endpoints/account';
import { accountKeys, generationKeys } from '@/lib/api/queryKeys';

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
  const queryClient = useQueryClient();
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
      // The quota is charged on enqueue, so the number on screen is one
      // behind the moment this resolves.
      void queryClient.invalidateQueries({ queryKey: accountKeys.usage() });
    },
  });
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
 * One finished generation, with its fit report.
 *
 * Fetched rather than read out of the job cache. The screen is reachable by
 * URL — the progress screen replaces itself with it, and a reload has to land
 * somewhere real — so what it shows cannot depend on this session having
 * watched the job happen.
 */
export function useGenerationResult(generationId: string) {
  return useQuery<Generation>({
    queryKey: generationKeys.detail(generationId),
    queryFn: () => getGeneration(generationId),
  });
}

/**
 * Asks for a covering letter, or for another draft of one.
 *
 * **Written into the cache rather than refetched.** The response carries the
 * letter itself and the server replaced the stored one, so a refetch would
 * ask for something already in hand.
 *
 * This is not the case the "edits on the result screen are not local state"
 * rule is about: that rule exists because editing the CV re-runs the pipeline
 * from Phase C and changes the whole result. A letter changes the letter.
 */
export function useCoverLetter(generationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CoverLetterRequest) => regenerateCoverLetter(generationId, body),
    onSuccess: (letter) => {
      queryClient.setQueryData<Generation>(generationKeys.detail(generationId), (current) =>
        current ? { ...current, coverLetter: letter.coverLetter } : current,
      );
    },
  });
}

/**
 * The thumb, and anything the reader chose to add to it.
 *
 * **Written into the generation's cache entry**, because that is where it
 * lives now: `GET /generations/{id}` carries `feedback` (`B-065`), so the
 * screen reads the standing verdict from the generation rather than from
 * whatever this session happened to send. A reload shows the thumb that was
 * pressed — and, the half that actually matters, the forty-eight hour grant
 * stays visible the day after it was given, which is when anybody would look
 * at `accessedAt`.
 *
 * Write-through rather than a refetch: the response **is** the record, and
 * the field it goes into is the same `FeedbackResponse`.
 */
export function useFeedback(generationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: FeedbackRequest) => submitFeedback(generationId, body),
    onSuccess: (recorded) => {
      queryClient.setQueryData<Generation>(generationKeys.detail(generationId), (current) =>
        current ? { ...current, feedback: recorded } : current,
      );
    },
  });
}

/**
 * How many generations this account has, in total.
 *
 * `limit: 1` because the number is the only thing wanted: `total` counts the
 * account rather than the page (`B-066`), so one row is enough to carry it and
 * asking for twenty would be twenty rows nobody reads.
 *
 * It exists for the deletion confirmation, which has to say what goes. A
 * figure arrived at by walking pages would be a different figure by the time
 * the walk finished — which is exactly why the server counts it.
 */
export function useGenerationCount() {
  return useQuery({
    queryKey: generationKeys.count(),
    queryFn: () => listGenerations({ limit: 1 }),
    select: (page) => page.total ?? 0,
  });
}
