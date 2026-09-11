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
import {
  deleteAccount,
  getAccountSettings,
  unsubscribe,
  updateAccountSettings,
  type AccountSettings,
} from '@/lib/api/endpoints/account';
import { accountKeys, authKeys, sessionKeys } from '@/lib/api/queryKeys';

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
 * Whether the caller has no account — `undefined` until the session answers.
 *
 * The one question in the product that is genuinely about the **session**
 * rather than about a capability, and it is asked in exactly one place: the
 * challenge (§ 35.7.4, `B-083`). A sessionless caller must send a Turnstile
 * token with an import and with a generation; an account must not, and the
 * server ignores one that arrives anyway. That is not a feature being
 * withheld, so no capability flag describes it and none should be pressed
 * into the job.
 *
 * The absence is left as `undefined` rather than folded into `true`: drawing
 * a challenge widget at somebody who turns out to have an account is a
 * control that appears and then disappears, and Turnstile is not free to
 * start.
 */
export function useIsAnonymous(): boolean | undefined {
  const { data } = useSession();

  return data === undefined ? undefined : !data.authenticated;
}

/**
 * Whether the covering-letter box may be offered at all (§ 35.7.3, `B-085`).
 *
 * **Its own flag now.** This read `canSaveHistory` for a day, because the
 * block published nothing about letters and that was the one field which
 * separated the two capability sets — a proxy that answered correctly only
 * because the two moved together. `F-028` asked for the real thing and got
 * it, along with a rule: every `feature` value
 * `FEATURE_REQUIRES_ACCOUNT` can carry has a boolean beside it in the block,
 * so a refusal the client could not have prevented is a contract bug rather
 * than a screen's oversight.
 *
 * Closed while the session is still loading, for the reason `AtomEditor`
 * gives about atom controls: a control that appears and then vanishes can be
 * pressed in between, and the `403` would land on somebody who was offered
 * the button.
 */
export function useCanWriteCoverLetter(): boolean {
  return useCapabilities()?.canWriteCoverLetter === true;
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
      /*
        Re-read straight away rather than waiting for a remount. Signing out
        does not leave the caller with nothing: the endpoint stamps a fresh
        anonymous session, and the screen underneath is the anonymous product.

        **`fetchQuery`, not `refetchQueries`**, and the difference is an
        invariant this project already knows: an invalidation with no
        observer does nothing. `clear()` has just removed every query, so a
        refetch finds nothing to refetch — it worked only because a mounted
        `useSession` happened to re-render for its own reasons and re-create
        the query. Where the caller of this hook sits *below* the component
        reading the session, that re-render never comes and the session
        silently stays as it was. Measured, on the settings screen.
        `fetchQuery` creates the entry and fills it either way.
      */
      await queryClient.fetchQuery({ queryKey: sessionKeys.current(), queryFn: getSession });
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
      // `fetchQuery` for the reason `useLogout` gives: after `clear()` there
      // is no query left for a refetch to find.
      await queryClient.fetchQuery({ queryKey: sessionKeys.current(), queryFn: getSession });
    },
  });
}

/**
 * Deletes the account, then throws the cache away.
 *
 * `clear()` for the same reason `useLogout` does it, only more so: what was
 * cached does not merely belong to somebody else now, it does not exist. The
 * read that follows is what turns the screen into the anonymous product —
 * the response cleared the cookie, so `GET /auth/session` stamps a fresh
 * anonymous session rather than refusing (§ 57.4).
 *
 * **This is where `fetchQuery` was measured to matter.** The button lives a
 * component below the one holding `useSession`, so nothing re-renders to
 * re-create the query a refetch would need — and the settings screen went on
 * showing an account that no longer existed.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      queryClient.clear();
      await queryClient.fetchQuery({ queryKey: sessionKeys.current(), queryFn: getSession });
    },
  });
}

/**
 * Whether the optional emails go out (§ 57.7, `B-096`).
 *
 * **An account's, not a profile's**, and the endpoint says so: it is `GET` and
 * `PATCH /account` rather than a corner of `PUT /profile/preferences`. That
 * endpoint *replaces* and is guarded by the profile's own `ETag`, so a
 * version conflict about a CV would refuse a change about an email — and
 * leaving the field out of a replace would be turning it off.
 *
 * Only mounted behind a session that has an account: an anonymous caller has
 * no address, so there is nothing to send and nothing to turn off.
 */
export function useAccountSettings() {
  return useQuery<AccountSettings>({
    queryKey: accountKeys.settings(),
    queryFn: getAccountSettings,
  });
}

/**
 * Writes it, and takes the answer as the truth.
 *
 * The response carries the value **as it now stands**, so the switch shows
 * the server rather than the press — which is the difference between a
 * control that reports a preference and one that reports a click. Written
 * through rather than invalidated: the body is the whole resource.
 */
export function useUpdateAccountSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAccountSettings,
    onSuccess: (settings) => queryClient.setQueryData(accountKeys.settings(), settings),
  });
}

/**
 * Turning the optional emails off from an inbox (§ 57.7, `B-096`).
 *
 * Nothing is written into the cache and nothing is invalidated, and both are
 * deliberate: the caller usually has **no session** — this is pressed from a
 * mail client — so there is no `accountKeys.settings()` entry to correct. A
 * reader who happens to be signed in gets the settings screen re-read when
 * they next open it, which is the ordinary staleness every other screen has.
 */
export function useUnsubscribe() {
  return useMutation({ mutationFn: (token: string) => unsubscribe(token) });
}
