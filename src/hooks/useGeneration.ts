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
  regenerateCoverLetter,
  startGeneration,
  type CoverLetterRequest,
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
