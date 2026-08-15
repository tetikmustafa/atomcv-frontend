/**
 * Frontend-only types. Nothing here may mirror a backend DTO — those come
 * from the generated `api.d.ts` (Bölüm 35.8).
 *
 * What is left is the error envelope, and it is no longer a mirror: the
 * vocabularies below are *derived* from the generated schema, so a code or
 * action the backend adds shows up here as a typecheck change rather than as
 * a file someone forgot to edit.
 *
 * The wrappers exist for one reason — the generated types make every field
 * optional (springdoc marks nothing required on `ApiError`) and leave both
 * unions closed. Neither shape is the one the client needs.
 */

import type { components } from './api';

/**
 * The 27 codes the server publishes (EK D.7). Derived, not transcribed.
 *
 * `params` keys are fixed per code and the server refuses to publish an
 * undeclared one, so a missing value is a catalogue fix — never a field
 * hand-added to a body, because that value will never arrive (D.9 · 11).
 */
export type ErrorCode = NonNullable<components['schemas']['ApiError']['code']>;

/**
 * Actions the server may offer as a way out of an error (Bölüm 35.4).
 *
 * Nine values as of EK D.9 · 23, now confirmed against the published enum.
 */
export type KnownResolutionAction = NonNullable<components['schemas']['Resolution']['action']>;

/**
 * The union stays open. An action added server-side must still render as a
 * button rather than crash the panel: silently dropping the user's only way
 * forward would break P4, and the generated enum is a snapshot of the day
 * `gen:api` last ran, not a promise.
 *
 * The frontend never invents one. The server owns the list; a plain dismiss
 * control outside the resolution row is fine, a synthesised action inside it
 * is not.
 */
export type ResolutionAction = KnownResolutionAction | (string & {});

export type Resolution = {
  action: ResolutionAction;
  params?: Record<string, unknown>;
};

/**
 * RFC 7807 problem detail, extended with the fields Bölüm 35.4 adds.
 *
 * `status` and `code` are required here although the schema marks them
 * optional: every error carries a code, including `INTERNAL_ERROR` on a 500
 * (D.9 · 12), and `toApiError` supplies both for a body that arrives without
 * them. Requiring them is what lets the error path have no undefined branch.
 *
 * `code` stays open for the same reason as `ResolutionAction`, plus one of
 * our own: `toApiError` synthesises `UNEXPECTED_ERROR` for an unreadable
 * body, which is deliberately not in the server's catalogue.
 *
 * `title` is developer-facing. User-facing text is resolved from the
 * `errors.{code}` translation key with `params` — the server sends keys, not
 * prose, because it does not know the user's UI language.
 */
export type ProblemDetail = {
  type?: string;
  title?: string;
  status: number;
  code: ErrorCode | (string & {});
  instance?: string;
  params?: Record<string, unknown>;
  resolutions?: Resolution[];
};
