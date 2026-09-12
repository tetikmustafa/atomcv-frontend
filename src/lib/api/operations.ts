/**
 * Binding a call to the operation it belongs to.
 *
 * These were written for the profile endpoints and moved here when the Stage
 * 2 ones needed them too. Picking a shape out of `components['schemas']` by
 * hand names the *noun*; going through the operation names the **response**,
 * so a change to the wrapper — a list that starts arriving inside an
 * envelope, a body that gains a field — is a typecheck failure rather than a
 * runtime surprise. It caught one the day it was written (`reorder*`).
 *
 * **An operation id is a name again** (`B-099`). springdoc used to number the
 * ones whose controller method name was not unique — `delete_1`, `update_1`,
 * `list_1` — and the number was *positional*: adding the applications
 * controller moved account deletion from `delete_1` to `delete_2` and nothing
 * failed to compile, because both answer 204 and both resolve to `void`. Four
 * endpoints were bound through their path for that one reason, and those
 * bindings are gone: § 35.8.1 makes `@Operation(operationId = …)` mandatory
 * and the backend's CI fails on an id ending in `_<number>`, so the hazard is
 * caught where it is created rather than worked around here.
 */

import type { operations } from '@/types/api';

/**
 * The one success response an operation declares.
 *
 * `202` is in the list because Stage 2 is where long work stopped answering
 * synchronously: `POST /generations` accepts and hands back a job (§ 35.3).
 * Without it the accepted body types as `void`, which is a lie the compiler
 * would happily let through.
 */
type Success<Op> = Op extends { responses: infer R }
  ? R[Extract<keyof R, 200 | 201 | 202 | 204>]
  : never;

/**
 * What a call resolves to: the success body in the media type asked for, or
 * `void` where the response declares no content at all. A 204 lands on the
 * second branch, which is why `delete*` needs no special case.
 *
 * The media type is a parameter because springdoc does not always say
 * `application/json`: an endpoint with no explicit `produces` is published
 * under the wildcard media type, and the accepted-job body is one of them.
 */
type Body<Op, Media extends string> =
  Success<Op> extends { content: infer Content }
    ? Media extends keyof Content
      ? Content[Media]
      : never
    : void;

export type Returns<Op extends keyof operations, Media extends string = 'application/json'> = Body<
  operations[Op],
  Media
>;

/**
 * What a call sends.
 *
 * `NonNullable` because an endpoint whose body is **entirely** optional
 * declares `requestBody?` — `POST …/cover-letter/regenerate` accepts `{}`
 * (`B-056`), and the generator marks the whole property optional to say so.
 * Matching on `requestBody:` alone missed those and resolved to `never`,
 * which surfaced as "argument of type … is not assignable to parameter of
 * type never" at the call site rather than as anything about a body.
 *
 * Operations that take no body at all declare `requestBody?: never`, and
 * `NonNullable<never>` is still `never`, so they are unaffected.
 */
type Sends<Op> =
  NonNullable<Op extends { requestBody?: infer R } ? R : never> extends {
    content: { 'application/json': infer Sent };
  }
    ? Sent
    : never;

export type Accepts<Op extends keyof operations> = Sends<operations[Op]>;
