'use client';

/**
 * The session, and the capability set that comes with it (§ 35.7).
 *
 * Authentication is a **capabilities question** here, not a second credential:
 * anonymous and signed-in callers carry the same `sid` cookie, and what
 * differs is the object this returns. That is why nothing in the app asks
 * "is there a user" — it asks what the caller may do.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProviders,
  getSession,
  logout,
  requestMagicLink,
  verifyMagicLink,
  type Capabilities,
} from '@/lib/api/endpoints/auth';
import { authKeys, sessionKeys } from '@/lib/api/queryKeys';

/**
 * Under this much left, the anonymous notice appears.
 *
 * Fifteen minutes because of what the notice is *for*: the way out is to sign
 * in, that means waiting for an email and clicking a link, and a warning that
 * arrives with less time than the remedy takes is only an announcement of a
 * loss. Longer would be a banner the user reads for two hours and stops
 * seeing.
 */
export const EXPIRY_NOTICE_MS = 15 * 60 * 1000;

/**
 * Read fresh, always.
 *
 * The endpoint answers `no-store` and `anonymousExpiresAt` **slides** with
 * activity (§ 35.7), so a cached copy counts down to an instant that has
 * already moved. Two overrides carry that:
 *
 * - `staleTime: 0` against the 30s default, which exists for the editor's
 *   hundreds of atom keys and is exactly wrong for a value with a clock in
 *   it.
 * - `refetchOnWindowFocus`, which is off globally so that autosave does not
 *   fight a tab switch. Here it is the whole point: the person who walked
 *   away for ninety minutes is the one the expiry notice is written for, and
 *   coming back to the tab is when they can still act on it.
 */
export function useSession() {
  return useQuery({
    queryKey: sessionKeys.current(),
    queryFn: getSession,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * What the caller may do, or `undefined` before the first answer.
 *
 * Call sites must read the absence as "not yet known" and close the gate:
 * drawing a control and taking it away once the session lands is worse than a
 * control that appears a moment late, because the first version can be
 * clicked. The individual flags are non-optional by derivation, so the only
 * uncertainty left is this one.
 */
export function useCapabilities(): Capabilities | undefined {
  return useSession().data?.capabilities;
}

/**
 * The sign-in providers this deployment has credentials for (§ 40.6.1).
 *
 * The opposite of `useSession` in every way that matters, which is why the
 * two overrides above are inverted here: this answer changes when the
 * deployment is reconfigured and at no other time, so re-reading it on a tab
 * switch would ask a question nobody has a new answer to.
 *
 * It fails quietly on purpose. The sign-in page has a second way in — the
 * magic link — so a provider list that did not arrive costs the reader some
 * buttons, not the page. The caller reads an empty list the same way it reads
 * an unconfigured deployment: there is nothing to draw.
 */
export function useProviders() {
  return useQuery({
    queryKey: authKeys.providers(),
    queryFn: getProviders,
    staleTime: Infinity,
  });
}

/**
 * Ends the session, then throws the cache away.
 *
 * `clear()` rather than an invalidation, and the difference is not
 * housekeeping: everything cached was fetched **as somebody**, and the next
 * caller is somebody else. An invalidation leaves the old profile on screen
 * until each query refetches; on a shared machine that is one person's CV
 * shown to the next.
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.clear();
      // Re-read straight away rather than waiting for a remount. Signing out
      // does not leave the caller with nothing: the endpoint stamps a fresh
      // anonymous session, and the screen underneath is the anonymous
      // product.
      await queryClient.refetchQueries({ queryKey: sessionKeys.all });
    },
  });
}

/**
 * Asks for a sign-in link.
 *
 * Nothing is invalidated on success, and nothing should be: a `202` means an
 * email may be on its way, not that anybody is signed in. The session changes
 * when the link is redeemed, in the other browser tab or the other device.
 */
export function useRequestMagicLink() {
  return useMutation({ mutationFn: requestMagicLink });
}

/**
 * Redeems a sign-in link, then throws the cache away.
 *
 * `clear()` for the same reason `useLogout` does it, arrived at from the
 * other side: everything cached was fetched as an **anonymous** caller, and
 * the caller is now an account. § 41.3.3 does promise that an upgraded
 * profile keeps its ids — but that promise only covers `upgraded`. In
 * `kept_existing` and `unavailable` the profile behind those same keys is a
 * different profile entirely, and there is nothing in the response that a
 * cache could use to tell the cases apart.
 */
export function useVerifyMagicLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyMagicLink,
    onSuccess: async () => {
      queryClient.clear();
      await queryClient.refetchQueries({ queryKey: sessionKeys.all });
    },
  });
}
