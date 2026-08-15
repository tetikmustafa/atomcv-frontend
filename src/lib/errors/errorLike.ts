/**
 * The shape the error UI renders, and the one place anything becomes it.
 *
 * The same failure arrives over two transports: a synchronous 4xx body for
 * preflight refusals, and the SSE `failed` event once a job is running
 * (Bölüm 30.6, 35.3). Both carry `code` + `params` + `resolutions`, and the
 * standing rule is that one renderer handles both — two parallel
 * `switch (code)` blocks is how the two paths drift until an error looks
 * different depending on when it happened.
 *
 * So this is deliberately not `ApiError`: an SSE failure has no HTTP status
 * and never passed through `fetch`. What both have in common is exactly the
 * three fields below.
 */

import { isApiError, NetworkError } from '@/lib/api/errors';
import type { Resolution } from '@/types/domain';

export type ErrorLike = {
  code: string;
  params?: Record<string, unknown>;
  resolutions: Resolution[];
};

/** Ours, not the server's: there is no response to carry a code (Bölüm 44.1). */
export const NETWORK_CODE = 'NETWORK_UNREACHABLE';

/** Last resort, and the same code `toApiError` synthesises for an unreadable body. */
export const UNEXPECTED_CODE = 'UNEXPECTED_ERROR';

/**
 * An SSE `failed` payload: a plain object off the wire, never an `Error`.
 * Recognised structurally, because that is the only thing it has — it did not
 * come through `fetch` and has no status to key on.
 */
function isStreamedFailure(value: unknown): value is Partial<ErrorLike> & { code: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}

export function toErrorLike(error: unknown): ErrorLike {
  if (isApiError(error)) {
    return { code: error.code, params: error.params, resolutions: error.resolutions };
  }

  if (isStreamedFailure(error)) {
    return {
      code: error.code,
      ...(error.params ? { params: error.params } : {}),
      resolutions: error.resolutions ?? [],
    };
  }

  // No resolutions on either of these. The server owns that list, and it did
  // not send one — a request that never arrived has no server opinion about
  // what to do next. Retrying is offered by the panel as its own control,
  // outside the resolution row, so nothing here is a synthesised action.
  if (error instanceof NetworkError) {
    return { code: NETWORK_CODE, resolutions: [] };
  }

  return { code: UNEXPECTED_CODE, resolutions: [] };
}
