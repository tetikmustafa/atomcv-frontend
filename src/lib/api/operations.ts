/**
 * Binding a call to the operation it belongs to.
 *
 * These were written for the profile endpoints and moved here when the Stage
 * 2 ones needed them too. Picking a shape out of `components['schemas']` by
 * hand names the *noun*; going through the operation names the **response**,
 * so a change to the wrapper — a list that starts arriving inside an
 * envelope, a body that gains a field — is a typecheck failure rather than a
 * runtime surprise. It caught one the day it was written (`reorder*`).
 */

import type { operations } from '@/types/api';

type Responses<Op extends keyof operations> = operations[Op]['responses'];

/**
 * The one success response an operation declares.
 *
 * `202` is in the list because Stage 2 is where long work stopped answering
 * synchronously: `POST /generations` accepts and hands back a job (§ 35.3).
 * Without it the accepted body types as `void`, which is a lie the compiler
 * would happily let through.
 */
type Success<Op extends keyof operations> = Responses<Op>[Extract<
  keyof Responses<Op>,
  200 | 201 | 202 | 204
>];

/**
 * What a call resolves to: the success body in the media type asked for, or
 * `void` where the response declares no content at all. A 204 lands on the
 * second branch, which is why `delete*` needs no special case.
 *
 * The media type is a parameter because springdoc does not always say
 * `application/json`: an endpoint with no explicit `produces` is published
 * under the wildcard media type, and the accepted-job body is one of them.
 */
export type Returns<Op extends keyof operations, Media extends string = 'application/json'> =
  Success<Op> extends { content: infer Body }
    ? Media extends keyof Body
      ? Body[Media]
      : never
    : void;

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
type RequestBody<Op extends keyof operations> = NonNullable<operations[Op]['requestBody']>;

export type Accepts<Op extends keyof operations> =
  RequestBody<Op> extends {
    content: { 'application/json': infer Body };
  }
    ? Body
    : never;
