'use client';

/**
 * The application tracker's server state (`B-093`).
 *
 * **One list, no pages.** `GET /applications` answers with everything, newest
 * first, so there is no cursor and no infinite query — and the whole list is
 * what every write invalidates.
 *
 * **Not optimistic.** Every write here is `If-Match`-guarded, and the version
 * the next write needs comes back in the response body. Guessing at a row and
 * rolling it back would leave the screen holding a version the server never
 * issued, which is the one state that makes every subsequent edit fail with a
 * `412` nobody can explain.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createApplication,
  deleteApplication,
  listApplications,
  patchApplication,
  type Application,
  type ApplicationCreate,
  type ApplicationUpdate,
} from '@/lib/api/endpoints/applications';
import { applicationKeys } from '@/lib/api/queryKeys';

export function useApplications(enabled: boolean) {
  return useQuery<Application[]>({
    queryKey: applicationKeys.list(),
    queryFn: listApplications,
    // The screen decides whether to ask: without an account there is nothing
    // here, and a request that comes back `401` is a worse way to say so than
    // a sentence.
    enabled,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ApplicationCreate) => createApplication(body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: applicationKeys.list() }),
  });
}

/**
 * Changing one row.
 *
 * The version travels in the body of every row, so it is taken from the row
 * the caller is editing rather than kept anywhere — which is what makes a
 * second tab's edit a `412` rather than a silent overwrite.
 */
export function usePatchApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version, body }: { id: string; version: number; body: ApplicationUpdate }) =>
      patchApplication(id, body, version),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: applicationKeys.list() }),
  });
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      deleteApplication(id, version),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: applicationKeys.list() }),
  });
}
