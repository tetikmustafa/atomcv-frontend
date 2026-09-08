/**
 * Error payloads captured from the running backend, rendered through the real
 * catalogue.
 *
 * The catalogue test next door proves every message survives the params the
 * contract *declares*. This one proves the sentence is right for what the
 * server actually sent — the two are not the same check, and `B-043` is
 * exactly where they came apart: the old message read `skillsFound` and would
 * have said "18 skills came out of it" while refusing the posting.
 *
 * Captured 2026-08-25 against `local-real` with `openai/gpt-4.1-nano`. When a
 * payload here stops matching the server, that is a contract change worth a
 * handoff item, not a test to relax.
 */
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import tr from '@/messages/tr.json';
import { formatErrorParams, type IcuValue } from '@/lib/errors/errorParams';

type LooseTranslator = (key: string, values?: Record<string, IcuValue>) => string;

/** Exactly as they came off the wire, `resolutions` included. */
const CAPTURED = [
  {
    what: 'the preflight refusing a three-word paste',
    transport: '422',
    params: { reason: 'too_short', confidence: 0, skillsFound: 0 },
    resolutions: ['continue_anyway', 'paste_full_posting', 'continue_as_general_cv'],
  },
  {
    what: 'the gate refusing a posting with no technical content',
    transport: 'stream',
    params: { reason: 'too_few_skills', confidence: 0.9, skillsFound: 0 },
    resolutions: ['paste_full_posting', 'continue_as_general_cv'],
  },
  /*
    A third capture stood here — the gate refusing a posting that named no
    responsibilities, at 0.92 confidence with twenty skills read. `B-072`
    removed the reason from the enum, so no server sends that payload any
    more and there is nothing left to capture. Not replaced by an invented
    one: the point of this file is that every payload in it was really sent.
  */
] as const;

/** `as const` for the same reason the catalogue test needs it: `describe.each`
 *  widens the locale to `string`, and `createTranslator` wants the union. */
const CATALOGUES = [
  ['en', en],
  ['tr', tr],
] as const;

describe.each(CATALOGUES)(
  '%s sentences for payloads the server really sent',
  (locale, messages) => {
    const t = createTranslator({
      locale,
      messages,
      namespace: 'errors',
    }) as unknown as LooseTranslator;

    it.each(CAPTURED)('reads as a sentence for $what', ({ params }) => {
      const rendered = t('UNPARSEABLE_JOB_DESCRIPTION', formatErrorParams(params, locale));

      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered).not.toMatch(/[{}]/);
      // The failure with no punctuation to notice: a missing `select` argument
      // renders the message as its own key path.
      expect(rendered).not.toContain('errors.');
      expect(rendered).not.toContain('UNPARSEABLE_JOB_DESCRIPTION');
    });

    /*
      `F-016`'s regression — a refusal that reads the count when the count is
      not what refused it — was asserted here against the `no_responsibilities`
      capture: 18 skills found and still refused. `B-072` retired that reason,
      and no remaining capture has a high count with a reason that ignores it.
      The check moved to the catalogue test, where it runs over every reason
      instead of the one payload that happened to be on disk.
    */
  },
);

describe('the resolutions those payloads carried', () => {
  it('drops continue_anyway once the preflight has already passed', () => {
    const [preflight, ...gate] = CAPTURED;

    expect(preflight.resolutions).toContain('continue_anyway');
    // Not a rule we invented: acknowledging the preflight cannot help with a
    // refusal that happened after the preflight passed (`B-043`).
    for (const refusal of gate) {
      expect(refusal.resolutions).not.toContain('continue_anyway');
      expect(refusal.resolutions).toHaveLength(2);
    }
  });

  it('only ever names actions the catalogue can label', () => {
    const label = createTranslator({
      locale: 'en',
      messages: en,
      namespace: 'resolutions',
    }) as unknown as LooseTranslator;

    for (const { resolutions } of CAPTURED) {
      for (const action of resolutions) {
        // An unlabelled action is dropped by the panel rather than drawn
        // nameless, so a server action we cannot name is a silently missing
        // button — the one way out of the screen, gone.
        expect(label(action)).not.toContain('resolutions.');
      }
    }
  });
});
