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

import type { operations, paths } from '@/types/api';

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
 * The same, for an operation named by its **path and method** instead of by
 * its id.
 *
 * springdoc numbers an operation id when the controller method name is not
 * unique across the application — `delete_1`, `update_1`, `list_1` — and the
 * number is **positional**. Adding the applications controller moved account
 * deletion from `delete_1` to `delete_2`, and nothing failed to compile:
 * both answer 204, so both resolve to `void`. A binding that silently means
 * a different endpoint is exactly what this module exists to prevent, so an
 * operation whose id carries a number is bound through its path, which the
 * server cannot renumber.
 *
 * Named ids stay on `Returns`: they are the schema's own stable names, and
 * rewriting forty call sites would trade one hazard for a diff nobody can
 * review.
 */
export type ReturnsAt<
  Path extends keyof paths,
  Method extends keyof paths[Path],
  Media extends string = 'application/json',
> = Body<paths[Path][Method], Media>;

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

/** `Accepts`, by path and method. See `ReturnsAt` for why both exist. */
export type AcceptsAt<Path extends keyof paths, Method extends keyof paths[Path]> = Sends<
  paths[Path][Method]
>;
