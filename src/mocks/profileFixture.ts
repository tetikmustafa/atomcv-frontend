/**
 * A small, mutable profile for the mock handlers.
 *
 * Stateful on purpose. The behaviour worth mocking is optimistic concurrency:
 * a version that moves when a write lands, a 412 when it has moved under you,
 * a 428 when no `If-Match` was sent. None of that can be expressed by handlers
 * returning fixed payloads, and it is the part of the editor most likely to
 * be got wrong.
 *
 * Types are the generated ones. Unlike `contracts.ts`, these endpoints are in
 * the published schema, so nothing here may be hand-shaped.
 */

import type { components } from '@/types/api';

type Schemas = components['schemas'];
export type MockAtom = Schemas['Atom'];
/**
 * The head, with `sourceLanguage` required — the same narrowing
 * `endpoints/profile.ts` applies, and for the same reason: the column is
 * `NOT NULL` and `PUT` refuses a body without it (`B-035`).
 *
 * Repeated here rather than imported so the mocks stay a description of the
 * wire, but repeating the *narrowing* is the point: a fixture that dropped
 * the field would hand the client a shape it has been told is impossible, and
 * every test would go on passing.
 */
export type MockProfile = Omit<Schemas['Profile'], 'sourceLanguage'> & { sourceLanguage: string };
export type MockSection = Schemas['Section'];
export type MockEntry = Schemas['Entry'];

export type ProfileFixture = {
  profile: MockProfile;
  /** The profile head's own version, which travels only as an `ETag`. */
  profileVersion: number;
  sections: MockSection[];
  entries: MockEntry[];
  atoms: MockAtom[];
};

function initial(): ProfileFixture {
  return {
    profileVersion: 1,
    profile: {
      headline: 'Senior Backend Engineer',
      contact: { name: 'Elif Yıldırım', email: 'elif@example.com' },
      sourceLanguage: 'en',
      enabledLanguages: ['en'],
      completeness: 80,
    },
    sections: [
      {
        id: 'sec-experience',
        kind: 'experience',
        title: 'Experience',
        layout: 'bullet_list',
        displayOrder: 0,
        active: true,
        alwaysInclude: false,
        verbatim: false,
        version: 0,
      },
      /*
        The other shape a section comes in: atoms hanging straight off it,
        with no entries. Both are here because the editor has to render both,
        and a fixture with only one of them let the missing half go unnoticed.
      */
      {
        id: 'sec-skills',
        kind: 'skills',
        title: 'Skills',
        layout: 'inline_list',
        displayOrder: 1,
        active: true,
        alwaysInclude: false,
        verbatim: false,
        version: 0,
      },
      /*
        The third shape, and the one `B-061` is about: an entry with **no**
        bullets under it. A degree has none, and until § 20.2 changed such a
        line could not reach a generated CV by any route — the alternative,
        making people write a bullet for every entry, is the padding this
        product exists to refuse.

        It is a fixture rather than a comment because the editor has to render
        it without complaint, and nothing else here has that shape.
      */
      {
        id: 'sec-education',
        kind: 'education',
        title: 'Education',
        layout: 'entry_list',
        displayOrder: 2,
        active: true,
        alwaysInclude: false,
        verbatim: false,
        version: 0,
      },
    ],

    /*
      Two jobs in one section. `displayOrder` on an atom is numbered **within
      its entry**, so both of these start at 0 — which is exactly why a flat
      render of the section interleaves them.
    */
    entries: [
      {
        id: 'entry-trendyol',
        sectionId: 'sec-experience',
        title: 'Senior Backend Engineer',
        organization: 'Trendyol',
        location: 'Istanbul',
        startDate: '2022-04-01',
        displayOrder: 0,
        importance: 0.9,
        active: true,
        alwaysInclude: false,
        verbatim: false,
        minAtoms: 2,
        version: 0,
      },
      {
        // No `endDate` on the one above: that is what "still there" looks
        // like on the wire, and the heading has to say so in words.
        id: 'entry-getir',
        sectionId: 'sec-experience',
        title: 'Backend Engineer',
        organization: 'Getir',
        location: 'Istanbul',
        startDate: '2019-08-01',
        endDate: '2022-03-01',
        displayOrder: 1,
        importance: 0.7,
        active: true,
        alwaysInclude: false,
        verbatim: false,
        minAtoms: 2,
        version: 0,
      },
      {
        // The degree. No atoms anywhere in the list carry this `entryId`, and
        // that is the point of it (`B-061`).
        //
        // `minAtoms` is still 2, because the server defaults it and the field
        // does not disappear. It simply does not apply: the floor is for
        // entries that *have* bullets, and an entry with none does not trip
        // it.
        id: 'entry-ytu',
        sectionId: 'sec-education',
        title: 'BSc Computer Engineering',
        organization: 'Yıldız Technical University',
        location: 'Istanbul',
        startDate: '2019-09-01',
        endDate: '2023-06-01',
        displayOrder: 0,
        importance: 0.6,
        active: true,
        alwaysInclude: false,
        verbatim: false,
        minAtoms: 2,
        version: 0,
      },
    ],
    atoms: [
      {
        id: 'atom-1',
        sectionId: 'sec-experience',
        entryId: 'entry-trendyol',
        kind: 'bullet',
        displayOrder: 0,
        importance: 0.6,
        active: true,
        alwaysInclude: false,
        verbatim: false,
        skills: [],
        metrics: ['900 stars'],
        properNouns: [],
        source: 'manual',
        verified: false,
        version: 0,
        variants: [
          {
            id: 'variant-1',
            primary: true,
            language: 'en',
            content: {
              v: 1,
              runs: [
                { t: 'Built a query monitor that reached ', m: [] },
                { t: '900 stars', m: ['metric'] },
              ],
            },
            plainText: 'Built a query monitor that reached 900 stars',
            contentHash: 'seeded',
            createdBy: 'user',
            stale: false,
            version: 0,
          },
        ],
      },
      {
        id: 'atom-2',
        sectionId: 'sec-experience',
        entryId: 'entry-trendyol',
        kind: 'bullet',
        displayOrder: 1,
        importance: 0.4,
        active: true,
        alwaysInclude: false,
        verbatim: false,
        skills: ['ETL'],
        metrics: [],
        properNouns: [],
        source: 'manual',
        verified: false,
        version: 0,
        // Two wordings, primary first, and the second one stale — the shape
        // Bölüm 37.6 is about. No atom on the running server has this yet
        // (every seeded atom has one Turkish wording), so the mock is the
        // only place the multi-variant path exists at all.
        variants: [
          {
            id: 'variant-2',
            primary: true,
            language: 'en',
            content: { v: 1, runs: [{ t: 'Engineered ETL pipelines', m: [] }] },
            plainText: 'Engineered ETL pipelines',
            contentHash: 'seeded',
            createdBy: 'user',
            stale: false,
            version: 0,
          },
          {
            id: 'variant-2-tr',
            primary: false,
            language: 'tr',
            content: { v: 1, runs: [{ t: 'ETL hatları kurdum', m: [] }] },
            plainText: 'ETL hatları kurdum',
            contentHash: 'seeded',
            createdBy: 'user',
            /*
              § 32.2's third row, the only one that asks a question: the source
              moved on **and** the person wrote this wording. Everything else
              here is `userEdited: false`, so the two branches of `StaleWording`
              are both reachable — pressing "write it again" turns this row
              into the other one.
            */
            stale: true,
            userEdited: true,
            version: 0,
          },
        ],
      },
      {
        // The second job's first bullet. `displayOrder: 0` again — the number
        // restarts inside each entry, so listing the section flat puts this
        // between the two above rather than after them.
        id: 'atom-3',
        sectionId: 'sec-experience',
        entryId: 'entry-getir',
        kind: 'bullet',
        displayOrder: 0,
        importance: 0.5,
        active: true,
        alwaysInclude: false,
        verbatim: false,
        skills: ['Kafka'],
        metrics: [],
        properNouns: [],
        source: 'manual',
        verified: false,
        version: 0,
        variants: [
          {
            id: 'variant-3',
            primary: true,
            language: 'en',
            content: { v: 1, runs: [{ t: 'Rewrote the courier assignment', m: [] }] },
            plainText: 'Rewrote the courier assignment',
            contentHash: 'seeded',
            createdBy: 'user',
            stale: false,
            version: 0,
          },
        ],
      },
      {
        // No `entryId`: hangs straight off its section, which is the normal
        // shape for skills.
        id: 'atom-4',
        sectionId: 'sec-skills',
        kind: 'skill',
        displayOrder: 0,
        importance: 0.8,
        active: true,
        alwaysInclude: false,
        verbatim: false,
        skills: ['Go'],
        metrics: [],
        properNouns: [],
        source: 'manual',
        verified: false,
        version: 0,
        variants: [
          {
            id: 'variant-4',
            primary: true,
            language: 'en',
            content: { v: 1, runs: [{ t: 'Go', m: ['technology'] }] },
            plainText: 'Go',
            contentHash: 'seeded',
            createdBy: 'user',
            stale: false,
            version: 0,
          },
        ],
      },
    ],
  };
}

export let fixture: ProfileFixture = initial();

/**
 * Called between tests. Without it one test's writes decide another's
 * starting versions, and the failure shows up in whichever test happens to
 * run second.
 */
export function resetProfileFixture() {
  fixture = initial();
}
