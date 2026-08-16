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
export type MockProfile = Schemas['Profile'];
export type MockSection = Schemas['Section'];

export type ProfileFixture = {
  profile: MockProfile;
  /** The profile head's own version, which travels only as an `ETag`. */
  profileVersion: number;
  sections: MockSection[];
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
    ],
    atoms: [
      {
        id: 'atom-1',
        sectionId: 'sec-experience',
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
            createdBy: 'llm_translate',
            stale: true,
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
