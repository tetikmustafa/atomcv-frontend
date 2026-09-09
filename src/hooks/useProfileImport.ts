'use client';

/**
 * Turning a CV into a profile (`B-051`, `B-053`).
 *
 * One code path for an account and for somebody who never signed in. § 31.6.3
 * is explicit that there is no second endpoint and no second flow — what
 * differs is where the server writes and which allowance it counts against,
 * and neither is the client's business.
 */

import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importCv } from '@/lib/api/endpoints/profile';
import { invalidateWholeProfile } from '@/hooks/useProfile';
import { accountKeys } from '@/lib/api/queryKeys';

export type ImportAttempt = {
  file: File;
  /** Set only by answering the server's own `replace_profile` (`B-060`). */
  replace?: boolean;
  /**
   * The challenge, for a caller without an account (§ 35.7.4, `B-083`).
   *
   * Passed per attempt rather than held here: a Turnstile token is
   * single-use, so the one that answered the `409` cannot answer the replace
   * that follows it. The screen owns the widget and hands over whichever
   * token is current.
   */
  challengeToken?: string;
};

/**
 * Identifies a file well enough to tell "the same upload again" from "a
 * different upload".
 *
 * Not the contents: hashing a ten-megabyte file to decide whether to reuse a
 * header would cost more than the request it protects, and the three fields
 * below already separate every file a person would plausibly pick in one
 * sitting.
 */
function identify(file: File) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

/**
 * Uploads a CV and hands back the accepted job.
 *
 * **The `Idempotency-Key` is per file, not per call.** An upload is the
 * request a bad connection retries most readily and profile extraction is the
 * smallest allowance in the product — three a day anonymously (§ 44.1) — so
 * pressing the button again after a dropped connection has to collapse into
 * the job the server already made rather than spend a second unit.
 *
 * **`replace` is deliberately not part of the key.** Answering a `409` with
 * `replace_profile` is the same attempt at the same file, one question later;
 * the refusal made no job for the key to collide with, and keeping the key
 * means a retry of the *replace* collapses too.
 *
 * The key is dropped on success: choosing the same file again, having seen
 * what it produced, is a second import and must be treated as one.
 */
export function useImportCv() {
  const queryClient = useQueryClient();
  const attempt = useRef<{ file: string; key: string } | null>(null);

  const keyFor = useCallback((file: File) => {
    const id = identify(file);
    if (attempt.current?.file !== id) {
      attempt.current = { file: id, key: crypto.randomUUID() };
    }
    return attempt.current.key;
  }, []);

  return useMutation({
    mutationFn: ({ file, replace, challengeToken }: ImportAttempt) =>
      importCv(file, {
        idempotencyKey: keyFor(file),
        ...(replace ? { replace } : {}),
        ...(challengeToken ? { challengeToken } : {}),
      }),
    onSuccess: () => {
      attempt.current = null;
      // Charged on enqueue, so the number on screen is one behind the moment
      // this resolves.
      void queryClient.invalidateQueries({ queryKey: accountKeys.usage() });
    },
  });
}

/**
 * Throws away everything cached about the profile.
 *
 * Called when an import job **finishes**, not when it is accepted: the rows
 * are written by the worker, so a cache dropped at the 202 would be refilled
 * from the old profile seconds before the new one existed.
 *
 * It reuses what a cascading delete does, because the situation is the same
 * one written larger — more of the profile changed than any single key
 * describes. `profileKeys.all` is still not the answer, and `useProfile` says
 * why: it is a prefix of the per-atom keys, whose `queryFn` exists only to
 * throw.
 */
export function useProfileReplaced() {
  const queryClient = useQueryClient();

  return useCallback(() => invalidateWholeProfile(queryClient), [queryClient]);
}
