/**
 * Validation for the profile's section and entry forms — the same schemas
 * serve adding and editing.
 *
 * **Checked against the generated request types, never restated.** The
 * `Extends<…>` aliases below are what make that true: rename a field on the
 * wire, or add a section kind, and this file stops compiling rather than
 * silently validating a shape the server no longer accepts.
 *
 * What is validated here is deliberately narrow. Most of it the server already
 * refuses and says so through RFC 7807 — an empty title is a `400` naming
 * `title`, an unknown `kind` a `400` naming `kind`, both verified — and
 * duplicating a rule the server owns is how the two drift. Two things earn a
 * client-side check:
 *
 * - **What is worth saying before the round trip.** A date range running
 *   backwards used to be accepted with a `201` and rendered as "Jan 2022 –
 *   Jan 2019" in the entry heading, which is what `F-002` was about. The
 *   server refuses it now — so this is no longer the only defence, but it is
 *   still the faster one and it puts the message next to the field. The two
 *   agree on the boundary: `>=`, and silence when there is no end date.
 *
 *   Where they differ is which field is *named*. A create is a `400` naming
 *   **both** ends (`B-036`), because the request sent both; this refine puts
 *   its one message under `endDate`. That is deliberate — both boxes are on
 *   screen and saying it twice is noise. `params.fields` is for a client
 *   deciding which input to point at, not a shape this has to mirror.
 * - **What a round trip would waste.** Refusing an empty title locally is the
 *   same answer the server gives, just sooner and next to the field.
 */

import { z } from 'zod';
import type { EntryCreate, EntryPatch, SectionCreate } from '@/lib/api/endpoints/profile';

/** Compile-time only: fails to resolve unless `T` is assignable to `U`. */
type Extends<T extends U, U> = T;

/**
 * Every message a schema here may produce.
 *
 * A closed set, and `validationKey` is what enforces it. Zod attaches its own
 * English default — "Invalid input" — to any failure that does not name one,
 * and rendering that raw would put an untranslated internal string in front of
 * a Turkish user. Rule 8 says the same thing about server error codes: resolve
 * a key, never display the developer-facing text.
 */
export const VALIDATION_KEYS = [
  'titleRequired',
  'titleTooLong',
  'organizationTooLong',
  'locationTooLong',
  'endBeforeStart',
  'invalidDate',
  'invalid',
] as const;

export type ValidationKey = (typeof VALIDATION_KEYS)[number];

/** Narrows a Zod message to a key the catalogue has, or falls back to one. */
export function validationKey(message: string | undefined): ValidationKey {
  return VALIDATION_KEYS.includes(message as ValidationKey)
    ? (message as ValidationKey)
    : 'invalid';
}

/** The wire's date shape. Not a `Date`: the API speaks `YYYY-MM-DD`. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate')
  .refine((value) => {
    // Round-tripped rather than range-checked, for the same reason
    // `formatMonthYear` does it: `Date.UTC` rolls 13 and 31 February over into
    // real, wrong dates instead of rejecting them.
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'invalidDate');

/**
 * The message keys are resolved through next-intl by the form, the same way
 * server error codes are (rule 8) — so validation reads in the user's language
 * from one catalogue rather than from strings baked in here.
 */
export const sectionForm = z.object({
  kind: z.enum([
    'about',
    'education',
    'experience',
    'projects',
    'skills',
    'soft_skills',
    'languages',
    'custom',
  ]),
  title: z.string().trim().min(1, 'titleRequired').max(120, 'titleTooLong'),
  /**
   * How the section is set (§ 33.4).
   *
   * **Four values, not five.** `two_column` left the vocabulary with `V17`
   * (`B-116`) and it is the one worth remembering why: the endpoint accepted
   * it, the CHECK allowed it, the schema published it, and the renderer
   * printed an entry list anyway — all three templates are single-column for
   * an ATS-extraction reason. So a person chose a layout, nothing said
   * otherwise, and their document printed a different one. The other dead
   * values cost a branch; that one cost somebody a choice they thought they
   * had made.
   *
   * **Offering it at all is D13's decision**, and the gap it closes was
   * explicit about its own condition: drawing the picker needs an ICU name
   * for every value *and* a sensible default for About, because half of it
   * would hand somebody a choice whose meaning they cannot read.
   */
  layout: z.enum(['bullet_list', 'entry_list', 'inline_list', 'paragraph']),
});

export type SectionFormValues = z.infer<typeof sectionForm>;

/** Fails to compile if the wire renames or re-types any of the three. */
export type _SectionFormFitsWire = Extends<
  SectionFormValues,
  Pick<SectionCreate, 'kind' | 'title' | 'layout'>
>;

/**
 * The same reverse check `kind` gets, and for the same reason: a layout added
 * server-side would otherwise be missing from the dropdown in silence.
 *
 * It has already been the other way round once. `paragraph` arrived with
 * `B-073` and nothing here noticed, because nothing here offered layouts at
 * all — which is what made "five values, no screen shows them" a state that
 * lasted a stage.
 */
export type _WireLayoutsAllOffered = Extends<
  NonNullable<SectionCreate['layout']>,
  SectionFormValues['layout']
>;

/**
 * What a section of this kind is usually set as (§ 33.4.1).
 *
 * The form opens on it rather than on a fixed `bullet_list`, because the
 * server already writes the right one per kind and a form that always
 * suggested bullets would be arguing with it. About is the case the section
 * names: a summary is one flowing paragraph, and printed as a list it reads
 * as the first item of a list that never comes.
 */
export const DEFAULT_LAYOUT: Record<SectionFormValues['kind'], SectionFormValues['layout']> = {
  about: 'paragraph',
  education: 'entry_list',
  experience: 'entry_list',
  projects: 'entry_list',
  skills: 'inline_list',
  soft_skills: 'inline_list',
  languages: 'inline_list',
  custom: 'bullet_list',
};

/**
 * And the reverse, for `kind` alone: a kind the server has added since the
 * last `gen:api` would otherwise just be missing from the dropdown, silently.
 *
 * This is the opposite call from `ResolutionAction`, which is deliberately
 * left open — that one *renders* whatever the server sends, so an unknown
 * value must not crash it. This one *offers* a fixed list, so an unknown value
 * is a feature we have not built, and a build failure is the right way to hear
 * about it.
 */
export type _WireKindsAllOffered = Extends<
  NonNullable<SectionCreate['kind']>,
  SectionFormValues['kind']
>;

export const entryForm = z
  .object({
    title: z.string().trim().min(1, 'titleRequired').max(200, 'titleTooLong'),
    // Empty strings rather than `undefined`, because that is what an untouched
    // text input holds; they are dropped on the way out, not sent as blanks.
    organization: z.string().trim().max(200, 'organizationTooLong'),
    location: z.string().trim().max(200, 'locationTooLong'),
    startDate: z.union([isoDate, z.literal('')]),
    endDate: z.union([isoDate, z.literal('')]),
  })
  .refine((values) => !(values.startDate && values.endDate) || values.endDate >= values.startDate, {
    // ISO dates compare correctly as strings, which is the point of the format.
    path: ['endDate'],
    message: 'endBeforeStart',
  });

export type EntryFormValues = z.infer<typeof entryForm>;

/**
 * What the entry form actually sends.
 *
 * Blank optional fields are **left out**, not sent as `""`. `EntryCreate`
 * treats an absent field as "not set"; an empty string is a value, and it is
 * the difference between a job with no end date — which the heading reads as
 * "still there" — and one with an end date the formatter cannot parse.
 */
export function toEntryCreate(sectionId: string, values: EntryFormValues): EntryCreate {
  return {
    sectionId,
    title: values.title.trim(),
    ...(values.organization.trim() ? { organization: values.organization.trim() } : {}),
    ...(values.location.trim() ? { location: values.location.trim() } : {}),
    ...(values.startDate ? { startDate: values.startDate } : {}),
    ...(values.endDate ? { endDate: values.endDate } : {}),
  };
}

/**
 * What the entry form sends when it is editing rather than adding.
 *
 * ⚠️ **Every field the form shows travels, blanks included — as `null`, not
 * omitted.** `PATCH` treats an absent field as "leave it alone", so clearing an
 * organisation by emptying the box would silently do nothing; `null` is how
 * the schema spells "clear this" for all four optional fields.
 *
 * It matters most for the dates. The server checks the range against the
 * **result** of the patch — one end against the other as stored — and
 * `params.fields` then names the ends the request actually sent (`B-036`).
 * Sending both ends every time is what keeps that error pointing at a field
 * the user can see: an error naming `endDate` on a request that only carried
 * `startDate` is not one they can act on.
 *
 * `title` is the exception. It is required, so it has no cleared state and
 * `null` is not a value the schema accepts for it.
 */
export function toEntryPatch(values: EntryFormValues): EntryPatch {
  return {
    title: values.title.trim(),
    organization: values.organization.trim() || null,
    location: values.location.trim() || null,
    startDate: values.startDate || null,
    endDate: values.endDate || null,
  };
}
