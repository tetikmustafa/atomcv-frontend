/**
 * Frontend-only types. Nothing here may mirror a backend DTO — those come
 * from the generated `api.d.ts` (Bölüm 35.8).
 *
 * The exception is the error envelope below. RFC 7807 is a wire standard
 * rather than a backend model, and the client cannot parse a single response
 * without it. Once the OpenAPI schema exists, check whether the backend
 * publishes a matching schema and switch to the generated type.
 */

/**
 * Actions the server may offer as a way out of an error (Bölüm 35.4).
 *
 * The list is open on purpose. The vocabulary is not fully specified yet, and
 * an unknown action must still render as a button rather than crash the panel
 * — silently dropping the user's only way forward would break P4.
 */
export type KnownResolutionAction =
  'increase_page_limit' | 'review_pins' | 'keep_top_pinned' | 'sign_up';

export type ResolutionAction = KnownResolutionAction | (string & {});

export type Resolution = {
  action: ResolutionAction;
  params?: Record<string, unknown>;
};

/**
 * RFC 7807 problem detail, extended with the fields Bölüm 35.4 adds.
 *
 * `title` is developer-facing. User-facing text is resolved from the
 * `errors.{code}` translation key with `params` — the server sends keys, not
 * prose, because it does not know the user's UI language.
 */
export type ProblemDetail = {
  type?: string;
  title?: string;
  status: number;
  instance?: string;
  code: string;
  params?: Record<string, unknown>;
  resolutions?: Resolution[];
};
