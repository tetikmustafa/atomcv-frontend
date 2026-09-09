/**
 * Stage 1 profile endpoints.
 *
 * These model the concurrency contract rather than the payloads: `If-Match`
 * is required, compared strictly, and answered with the same three outcomes
 * the running backend gives — 200 with a bumped version, `412
 * VERSION_CONFLICT` with a `retry` resolution, `428 PRECONDITION_REQUIRED`
 * with none. All three were checked against the real API before being
 * written down here.
 */

import { http, HttpResponse } from 'msw';
import { problem } from './problem';
import {
  fixture,
  type MockAtom,
  type MockEntry,
  type MockProfile,
  type MockSection,
} from './profileFixture';
import { currentMaxAtoms, isAccount } from './sessionFixture';

/**
 * Skill names the dictionary folds into one (`B-077`).
 *
 * A handful rather than a copy of `SkillNames`: what the screen has to
 * survive is that **what comes back is not what went in** — a spelling
 * rewritten, and two spellings collapsing into one entry. Three synonyms
 * demonstrate both; sixty would only be a second dictionary to keep in step
 * with the server's.
 */
const SKILL_SYNONYMS: Record<string, string> = {
  postgresql: 'postgres',
  'node-js': 'nodejs',
  golang: 'go',
};

/**
 * One skill, as it is stored (§ 31.5, `B-077`).
 *
 * The column is read as a **key** — Faz B scores against it and `RunMarking`
 * asks it whether a highlighted phrase is a technology — so the server
 * canonicalises on write and answers with the stored form. The import path
 * always did this; the editor did not, and the same column held keys in one
 * row and prose in the next.
 *
 * `toLocaleLowerCase('en')` rather than the ambient locale: rule 11, and this
 * is exactly the trap it names. Under `tr`, `I` lowercases to a dotless `ı`
 * and `SQLite` would canonicalise to something no dictionary has.
 */
function canonicalSkill(raw: string): string {
  const slug = raw
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[\s_/]+/g, '-')
    .replace(/[^a-z0-9+#.-]/g, '')
    .replace(/^-+|-+$/g, '');

  return SKILL_SYNONYMS[slug] ?? slug;
}

/**
 * The whole list, canonical and deduplicated — so it can come back
 * **shorter** than it was sent, which is the case the screen has to redraw
 * from the response rather than from what it sent.
 */
function canonicalSkills(values: readonly string[] | undefined): string[] | undefined {
  if (!values) return undefined;

  const seen = new Set<string>();
  for (const value of values) {
    const name = canonicalSkill(value);
    if (name) seen.add(name);
  }

  return [...seen];
}

/**
 * The atom fields § 35.7.2 keeps for accounts (`B-081`).
 *
 * A patch touching any of them from an anonymous session is refused **whole**
 * — there is no partial write — which is why this is a list of names rather
 * than a filter.
 */
const ACCOUNT_ONLY_ATOM_FIELDS = ['importance', 'active', 'alwaysInclude', 'verbatim'] as const;

/**
 * The kinds the server accepts, so the mock refuses exactly what the server
 * refuses — a `400` naming `kind`, verified against the running API.
 *
 * `satisfies` checks each of these is a real kind. It does **not** check the
 * list is complete, so a kind added upstream would be rejected here while the
 * server accepted it. What catches that is the reverse assertion in
 * `lib/forms/profileSchemas.ts`, which fails the build for the dropdown; this
 * list is updated in the same edit.
 */
const SECTION_KINDS = [
  'about',
  'education',
  'experience',
  'projects',
  'skills',
  'soft_skills',
  'languages',
  'custom',
] as const satisfies readonly NonNullable<MockSection['kind']>[];

/**
 * The check every write shares.
 *
 * Quoting is the point. The real server compares `If-Match` literally, so an
 * unquoted `2` fails against version 2 — verified, and the reason
 * `toIfMatch` exists. A mock that accepted the unquoted form would hide the
 * one mistake this is here to catch.
 */
function precondition(request: Request, instance: string, version: number) {
  const ifMatch = request.headers.get('If-Match');

  if (!ifMatch) {
    return HttpResponse.json(problem(428, 'PRECONDITION_REQUIRED', instance), { status: 428 });
  }
  if (ifMatch !== `"${version}"`) {
    return HttpResponse.json(problem(412, 'VERSION_CONFLICT', instance, [{ action: 'retry' }]), {
      status: 412,
    });
  }
  return undefined;
}

/**
 * What the seed profile's completeness responds to, as measured: 80 without a
 * `selfDescription`, 90 with one. Narrow on purpose — this models the one
 * input the head editor can actually change, not the server's whole formula.
 */
function completenessOf(selfDescription: string | undefined): number {
  return selfDescription?.trim() ? 90 : 80;
}

function findAtom(id: string): MockAtom | undefined {
  return fixture.atoms.find((atom) => atom.id === id);
}

export const profileHandlers = [
  /** The head. Never 404s, and its version travels only as an ETag. */
  http.get('*/api/v1/profile', () =>
    HttpResponse.json(fixture.profile, {
      headers: { ETag: `"${fixture.profileVersion}"` },
    }),
  ),

  /**
   * Replacing the head. **`PUT`, and an omitted field is cleared** — verified
   * against the running server, where sending only `headline` and
   * `enabledLanguages` left `contact` as `{}`. The mock clears too, because a
   * lenient one would let a client that sends a diff work here and wipe a real
   * user's contact details in production.
   *
   * `enabledLanguages` is required and may not be empty: both are a `400`
   * naming it, measured. `contact.email` is validated server-side as well, so
   * that is reproduced rather than left to the client.
   */
  http.put('*/api/v1/profile', async ({ request }) => {
    const instance = '/api/v1/profile';
    const refused = precondition(request, instance, fixture.profileVersion);
    if (refused) return refused;

    const body = (await request.json()) as {
      headline?: string;
      contact?: NonNullable<MockProfile['contact']>;
      selfDescription?: string;
      sourceLanguage?: string;
      enabledLanguages?: string[];
    };

    // `B-035`: both language fields are required in the body, and an empty
    // `enabledLanguages` counts as missing. `sourceLanguage` joined them when
    // `F-004` closed — it used to be the one field an omitting `PUT` left
    // alone, and it could not start clearing instead because the column is
    // `NOT NULL` and its default would have turned a Turkish profile English.
    const { sourceLanguage, enabledLanguages } = body;

    if (!sourceLanguage || !enabledLanguages?.length) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], {
          fields: [
            ...(sourceLanguage ? [] : ['sourceLanguage']),
            ...(enabledLanguages?.length ? [] : ['enabledLanguages']),
          ],
        }),
        { status: 400 },
      );
    }

    const email = body.contact?.email;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['contact.email'] }),
        { status: 400 },
      );
    }

    // `F-003` closed: a response that carries `completeness` carries the value
    // from **after** the write. It used to answer with the previous one, which
    // hid behind the fact that two writes changing nothing agree.
    //
    // The rule is about *responses that carry it*, not about the column: the
    // section, entry and atom endpoints do not return the head at all and
    // still leave the number to the next read. That is why the delete hooks
    // invalidate the head and this one no longer has to.

    // Assigned, not merged: what is not sent is gone.
    fixture.profile = {
      ...fixture.profile,
      headline: body.headline ?? undefined,
      contact: body.contact ?? {},
      selfDescription: body.selfDescription ?? undefined,
      // No exceptions left: `PUT` replaces the whole head (`F-004`). Both are
      // narrowed by the guard above rather than asserted here — the fixture
      // requires them, so a `!` would only move the lie somewhere quieter.
      sourceLanguage,
      enabledLanguages,
      completeness: completenessOf(body.selfDescription),
    };
    fixture.profileVersion += 1;

    return HttpResponse.json(fixture.profile, {
      headers: { ETag: `"${fixture.profileVersion}"` },
    });
  }),

  http.get('*/api/v1/profile/sections', () => HttpResponse.json(fixture.sections)),

  /**
   * Creating a section. **201** with the whole section, `layout` defaulted to
   * `bullet_list`, `displayOrder` appended — measured against the running
   * server, which also refuses an unknown `kind` with a `400` naming it.
   */
  http.post('*/api/v1/profile/sections', async ({ request }) => {
    const instance = '/api/v1/profile/sections';
    const body = (await request.json()) as {
      kind?: MockSection['kind'];
      title?: string;
      layout?: MockSection['layout'];
    };

    const fields = [
      ...(body.kind && SECTION_KINDS.includes(body.kind) ? [] : ['kind']),
      ...(body.title?.trim() ? [] : ['title']),
    ];

    if (fields.length > 0) {
      return HttpResponse.json(problem(400, 'VALIDATION_FAILED', instance, [], { fields }), {
        status: 400,
      });
    }

    const created: MockSection = {
      id: `sec-new-${fixture.sections.length + 1}`,
      kind: body.kind!,
      title: body.title!.trim(),
      layout: body.layout ?? 'bullet_list',
      displayOrder: fixture.sections.length,
      active: true,
      alwaysInclude: false,
      verbatim: false,
      version: 0,
    };

    fixture.sections.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  /**
   * Creating an entry. **201** with the whole entry, `importance` 0.5 and
   * `minAtoms` 2 defaulted, `displayOrder` appended within its section.
   *
   * **A backwards date range is a 400** naming `endDate`, which is what the
   * server answers since `F-002` closed — re-verified against it. Until then
   * this handler accepted the range on purpose, to match a server that did.
   *
   * `>=`, not `>`: a one-day certificate or hackathon is a real entry, so
   * equal dates pass. A missing `endDate` passes too — "ongoing" has no second
   * date to compare against.
   */
  http.post('*/api/v1/profile/entries', async ({ request }) => {
    const instance = '/api/v1/profile/entries';
    const body = (await request.json()) as {
      sectionId?: string;
      title?: string;
      organization?: string;
      location?: string;
      startDate?: string;
      endDate?: string;
    };

    if (!body.title?.trim() || !body.sectionId) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], {
          fields: body.title?.trim() ? ['sectionId'] : ['title'],
        }),
        { status: 400 },
      );
    }

    // Compared as strings, which is safe for `YYYY-MM-DD` and avoids the
    // timezone question `Date` would drag in for a value that has no time.
    if (body.startDate && body.endDate && body.endDate < body.startDate) {
      // `B-036`: `params.fields` names the ends the request actually sent, and
      // a create sends both. A `PATCH` naming one end gets that one back.
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], {
          fields: ['startDate', 'endDate'],
        }),
        { status: 400 },
      );
    }

    const siblings = fixture.entries.filter((entry) => entry.sectionId === body.sectionId);

    const created: MockEntry = {
      id: `entry-new-${fixture.entries.length + 1}`,
      sectionId: body.sectionId,
      title: body.title.trim(),
      ...(body.organization ? { organization: body.organization } : {}),
      ...(body.location ? { location: body.location } : {}),
      ...(body.startDate ? { startDate: body.startDate } : {}),
      ...(body.endDate ? { endDate: body.endDate } : {}),
      displayOrder: siblings.length,
      importance: 0.5,
      active: true,
      alwaysInclude: false,
      verbatim: false,
      minAtoms: 2,
      version: 0,
    };

    fixture.entries.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.get('*/api/v1/profile/entries', ({ request }) => {
    const sectionId = new URL(request.url).searchParams.get('sectionId');

    return HttpResponse.json(
      fixture.entries.filter((entry) => !sectionId || entry.sectionId === sectionId),
    );
  }),

  /**
   * Unpaginated, and the only source of per-atom versions.
   *
   * **Sorted by `displayOrder` alone, which interleaves the entries.** That
   * number restarts inside each entry, so every entry's first bullet is a 0
   * and the flat list alternates between jobs — measured on the running
   * server, where a ten-atom section came back as 0,0,0,1,1,1,2,2,3,4.
   *
   * Answering in a conveniently grouped order instead would let a flat render
   * look correct in development and be wrong in production, which is the drift
   * this mock exists to prevent. Grouping is the client's job, and it comes
   * from `entryId`, never from the order.
   */
  http.get('*/api/v1/profile/atoms', ({ request }) => {
    const filter = new URL(request.url).searchParams;
    const sectionId = filter.get('sectionId');
    const entryId = filter.get('entryId');

    return HttpResponse.json(
      fixture.atoms
        .filter(
          (atom) =>
            (!sectionId || atom.sectionId === sectionId) && (!entryId || atom.entryId === entryId),
        )
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    );
  }),

  /**
   * Creating an atom, with its first wording in the same request.
   *
   * Measured against the running server: **201**, and the body is the whole
   * `Atom` including the variant it just made — id, `contentHash`, `version: 0`
   * — with `displayOrder` appended to the end of its group and `importance`
   * defaulted. No `ETag` header; the version rides in the body like every
   * other atom's.
   *
   * **No `If-Match` and no idempotency.** There is no version to quote for
   * something that does not exist, and `Idempotency-Key` covers the Stage 2
   * endpoints that start work rather than profile creates
   * (`spec/08b-api-contract.md` § D.6.5). So two requests make two atoms — the mock does
   * that too, deliberately. A mock that quietly de-duplicated would hide the
   * exact failure the submit button's disabled state exists to prevent.
   */
  http.post('*/api/v1/profile/atoms', async ({ request }) => {
    const instance = '/api/v1/profile/atoms';
    const body = (await request.json()) as {
      sectionId: string;
      entryId?: string;
      kind: NonNullable<MockAtom['kind']>;
      content: { runs?: { t: string; m?: string[] }[] };
      language?: string;
      importance?: number;
      skills?: string[];
      metrics?: string[];
      properNouns?: string[];
    };

    const runs = body.content?.runs ?? [];
    if (!body.sectionId || !body.kind || runs.length === 0) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['content'] }),
        { status: 400 },
      );
    }

    /*
      § 35.7.2's ceiling, enforced since `B-081` — and a `422` rather than a
      `403`, because nothing about the request is forbidden: this profile is
      simply full. Both numbers travel so the screen can say "sixty of sixty"
      instead of "too many".

      **No resolutions.** `B-081` publishes `sign_up` for the two `403`s and
      names none here, and a mock that invented one would teach the client a
      button the server never sends.
    */
    const ceiling = currentMaxAtoms();
    if (ceiling !== undefined && fixture.atoms.length >= ceiling) {
      return HttpResponse.json(
        problem(422, 'ATOM_LIMIT_EXCEEDED', instance, [], {
          limit: ceiling,
          current: fixture.atoms.length,
        }),
        { status: 422 },
      );
    }

    const group = fixture.atoms.filter(
      (atom) =>
        atom.sectionId === body.sectionId &&
        (body.entryId === undefined ? atom.entryId === undefined : atom.entryId === body.entryId),
    );

    const plainText = runs.map((run) => run.t).join('');
    const suffix = fixture.atoms.length + 1;

    const created: MockAtom = {
      id: `atom-new-${suffix}`,
      sectionId: body.sectionId,
      ...(body.entryId ? { entryId: body.entryId } : {}),
      kind: body.kind,
      displayOrder: group.length,
      importance: body.importance ?? 0.5,
      active: true,
      alwaysInclude: false,
      verbatim: false,
      // Canonical on the way in (`B-077`): the import path always did this and
      // the create path did not, so one column held keys in one row and prose
      // in the next.
      skills: canonicalSkills(body.skills) ?? [],
      metrics: body.metrics ?? [],
      properNouns: body.properNouns ?? [],
      source: 'manual',
      verified: false,
      version: 0,
      variants: [
        {
          id: `variant-new-${suffix}`,
          primary: true,
          language: body.language ?? 'en',
          content: { v: 1, runs: runs.map((run) => ({ t: run.t, m: run.m ?? [] })) },
          plainText,
          contentHash: 'created',
          createdBy: 'user',
          stale: false,
          version: 0,
        },
      ],
    };

    fixture.atoms.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  /**
   * Reordering takes the **complete** list of the group being ordered; a
   * partial one is a 400 (`spec/08-api.md`). The mock enforces that, because a client
   * that sends only the moved items works perfectly against a lenient mock
   * and fails against the real API.
   */
  /**
   * Editing a section. Only the fields the editor offers are modelled — the
   * title, and the kind that decides what an atom under it is called.
   */
  http.patch('*/api/v1/profile/sections/:id', async ({ request, params }) => {
    const id = String(params.id);
    const instance = `/api/v1/profile/sections/${id}`;
    const section = fixture.sections.find((candidate) => candidate.id === id);

    if (!section) {
      return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
    }

    const refused = precondition(request, instance, section.version ?? 0);
    if (refused) return refused;

    const body = (await request.json()) as { title?: string; kind?: MockSection['kind'] };

    const fields = [
      ...('title' in body && !body.title?.trim() ? ['title'] : []),
      ...('kind' in body && !(body.kind && SECTION_KINDS.includes(body.kind)) ? ['kind'] : []),
    ];

    if (fields.length > 0) {
      return HttpResponse.json(problem(400, 'VALIDATION_FAILED', instance, [], { fields }), {
        status: 400,
      });
    }

    if (body.title !== undefined) section.title = body.title.trim();
    if (body.kind !== undefined) section.kind = body.kind;
    section.version = (section.version ?? 0) + 1;

    return HttpResponse.json(section, { headers: { ETag: `"${section.version}"` } });
  }),

  /**
   * Editing an entry.
   *
   * ⚠️ **The date rule is checked against the result of the patch, not against
   * the body** (`F-002`): patching one end compares it with the other end as
   * stored, or the range could be inverted one field at a time.
   *
   * `params.fields` names the ends the request actually sent (`B-036`) — the
   * client can only correct what it put on screen. And a patch that touches
   * **no** date is not checked at all, deliberately: a row written backwards
   * before `F-002` closed would otherwise refuse an unrelated title edit,
   * naming a field the form is not even showing.
   */
  http.patch('*/api/v1/profile/entries/:id', async ({ request, params }) => {
    const id = String(params.id);
    const instance = `/api/v1/profile/entries/${id}`;
    const entry = fixture.entries.find((candidate) => candidate.id === id);

    if (!entry) {
      return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
    }

    const refused = precondition(request, instance, entry.version ?? 0);
    if (refused) return refused;

    const body = (await request.json()) as {
      title?: string;
      organization?: string | null;
      location?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    };

    if ('title' in body && !body.title?.trim()) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['title'] }),
        { status: 400 },
      );
    }

    const touched = (['startDate', 'endDate'] as const).filter((field) => field in body);

    if (touched.length > 0) {
      // The result of the patch, not the body.
      const start = 'startDate' in body ? body.startDate : entry.startDate;
      const end = 'endDate' in body ? body.endDate : entry.endDate;

      if (start && end && end < start) {
        return HttpResponse.json(
          problem(400, 'VALIDATION_FAILED', instance, [], { fields: touched }),
          { status: 400 },
        );
      }
    }

    for (const field of ['title', 'organization', 'location', 'startDate', 'endDate'] as const) {
      if (!(field in body)) continue;
      const value = body[field];
      // `null` clears; the schema says so for every one of these but `title`.
      if (value === null || value === '') delete entry[field];
      else entry[field] = typeof value === 'string' ? value.trim() : value;
    }

    entry.version = (entry.version ?? 0) + 1;
    return HttpResponse.json(entry, { headers: { ETag: `"${entry.version}"` } });
  }),

  /**
   * Reordering the sections.
   *
   * ⚠️ **A reorder versions the rows it moves, and only those** — measured:
   * four sections at 0, swap the first two, and they come back `[1, 1, 0, 0]`.
   * Reproduced here because a mock that left the versions alone would let a
   * client which never refreshed them pass, and then 412 in production on the
   * next delete. That failure was already made once, at the variant endpoint
   * (handoff `B-034`).
   *
   * Answers with the **whole** collection, renumbered — unlike the atom and
   * entry reorders, which answer with one group.
   */
  http.post('*/api/v1/profile/sections/reorder', async ({ request }) => {
    const instance = '/api/v1/profile/sections/reorder';
    const body = (await request.json()) as { ids: string[] };

    const named = new Set(body.ids);
    const complete =
      fixture.sections.length === body.ids.length &&
      fixture.sections.every((section) => named.has(section.id!));

    // A partial list is a 400 naming `ids`, and so is an id that is not there.
    if (!complete) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['ids'] }),
        {
          status: 400,
        },
      );
    }

    const byId = new Map(fixture.sections.map((section) => [section.id, section]));

    fixture.sections = body.ids.map((id, index) => {
      const section = byId.get(id)!;
      // Only a row that actually moved is written, so only it is versioned.
      if (section.displayOrder === index) return section;
      return { ...section, displayOrder: index, version: (section.version ?? 0) + 1 };
    });

    return HttpResponse.json(fixture.sections);
  }),

  /**
   * Reordering the entries inside one section.
   *
   * Answers with **that section's group only** — measured: two rows where the
   * profile has six, the same scope the atom reorder answers with. Versions
   * move for the rows that moved; their atoms are untouched, which was also
   * measured rather than assumed.
   */
  http.post('*/api/v1/profile/entries/reorder', async ({ request }) => {
    const instance = '/api/v1/profile/entries/reorder';
    const body = (await request.json()) as { sectionId: string; ids: string[] };

    const group = fixture.entries.filter((entry) => entry.sectionId === body.sectionId);
    const named = new Set(body.ids);
    const complete =
      group.length === body.ids.length && group.every((entry) => named.has(entry.id!));

    // The real server refuses a `sectionId` that disagrees with the ids the
    // same way it refuses a partial list — both are a 400 naming `ids`.
    if (!complete) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['ids'] }),
        {
          status: 400,
        },
      );
    }

    const reordered = body.ids.map((id, index) => {
      const entry = group.find((candidate) => candidate.id === id)!;
      if (entry.displayOrder === index) return entry;
      return { ...entry, displayOrder: index, version: (entry.version ?? 0) + 1 };
    });

    const updated = new Map(reordered.map((entry) => [entry.id, entry]));
    fixture.entries = fixture.entries.map((entry) => updated.get(entry.id) ?? entry);
    fixture.entries.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

    return HttpResponse.json(reordered);
  }),

  http.post('*/api/v1/profile/atoms/reorder', async ({ request }) => {
    const instance = '/api/v1/profile/atoms/reorder';
    const body = (await request.json()) as { sectionId: string; entryId?: string; ids: string[] };

    const group = fixture.atoms.filter(
      (atom) =>
        atom.sectionId === body.sectionId &&
        (body.entryId === undefined || atom.entryId === body.entryId),
    );

    const named = new Set(body.ids);
    const complete = group.length === body.ids.length && group.every((atom) => named.has(atom.id!));

    if (!complete) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['ids'] }),
        { status: 400 },
      );
    }

    body.ids.forEach((id, index) => {
      const atom = findAtom(id);
      if (atom) atom.displayOrder = index;
    });
    fixture.atoms.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

    // The reordered group, renumbered — not the whole section. Measured
    // against the running backend: a five-atom entry inside a ten-atom
    // section answers with five, which is why a caller cannot write this
    // response through and skip refetching the section's collection.
    //
    // This used to answer `200` with an empty body, and the client was typed
    // `void` to match it. The server has never behaved that way; binding the
    // client to `operations` is what exposed the drift.
    return HttpResponse.json(
      group.slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    );
  }),

  /** Controls only. Text goes through the variant endpoint. */
  http.patch('*/api/v1/profile/atoms/:id', async ({ request, params }) => {
    const id = String(params.id);
    const instance = `/api/v1/profile/atoms/${id}`;
    const atom = findAtom(id);

    if (!atom) {
      return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
    }

    const refused = precondition(request, instance, atom.version ?? 0);
    if (refused) return refused;

    const patch = (await request.json()) as Partial<MockAtom>;

    /*
      § 35.7.2, enforced since `B-081`: the controls belong to an account, and
      a patch that touches one is refused **whole**. The all-or-nothing part
      is the behaviour worth encoding — a mock that dropped the offending
      field and saved the rest would let a client ship that quietly loses half
      of what the user changed.

      `params.feature` says which control it was, so the panel can name the
      button rather than putting up a general wall.
    */
    if (!isAccount() && ACCOUNT_ONLY_ATOM_FIELDS.some((field) => field in patch)) {
      return HttpResponse.json(
        problem(403, 'FEATURE_REQUIRES_ACCOUNT', instance, [{ action: 'sign_up' }], {
          feature: 'atom_controls',
        }),
        { status: 403 },
      );
    }

    Object.assign(atom, patch, {
      // The stored form, not the sent one (`B-077`). Written back over the
      // patch so the response — which is what the editor redraws from —
      // carries what was actually kept.
      ...(patch.skills ? { skills: canonicalSkills(patch.skills) } : {}),
      version: (atom.version ?? 0) + 1,
    });

    return HttpResponse.json(atom, { headers: { ETag: `"${atom.version}"` } });
  }),

  /** Wording. The whole content is sent; the atom's own version is untouched. */
  http.patch('*/api/v1/profile/atoms/:id/variants/:variantId', async ({ request, params }) => {
    const id = String(params.id);
    const variantId = String(params.variantId);
    const instance = `/api/v1/profile/atoms/${id}/variants/${variantId}`;
    const variant = findAtom(id)?.variants?.find((candidate) => candidate.id === variantId);

    if (!variant) {
      return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
    }

    const refused = precondition(request, instance, variant.version ?? 0);
    if (refused) return refused;

    const body = (await request.json()) as {
      content?: NonNullable<typeof variant.content>;
      tone?: string | null;
      primary?: boolean;
      userEdited?: boolean;
    };

    /*
      A wording becomes yours by writing words, never by claiming it, so the
      server refuses `true` (`B-052`). The refusal is encoded here although
      nothing in the client sends it — a mock that accepted it would teach the
      client that it works.

      The **shape** of that refusal is our reading rather than something the
      handoff publishes: it says the request is rejected and not with what.
      Nothing depends on the code, because nothing sends the request.
    */
    if (body.userEdited === true) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['userEdited'] }),
        { status: 400 },
      );
    }

    /*
      Handing a wording back (`B-052`). The flag clears and the row **stays
      stale** — the regeneration is a background job, so what the reader sees
      next is "being rewritten", not a finished sentence. A mock that also
      cleared `stale` would skip the only state the screen has a message for.
    */
    if (body.userEdited === false) variant.userEdited = false;

    // Nothing is required. A promote is `{ primary: true }` and carries no
    // content — resending the wording used to be the only way, and it cleared
    // `tone` every time (handoff B-028). A mock that still demanded `content`
    // would let that regression back in unnoticed.
    if (body.content) {
      variant.content = body.content;
      variant.plainText = (body.content.runs ?? []).map((run) => run.t).join('');
    }

    // Three-state: absent keeps what is there, `null` returns to the neutral
    // register, a value sets it.
    if ('tone' in body) {
      if (body.tone === null) delete variant.tone;
      else variant.tone = body.tone as typeof variant.tone;
    }

    variant.version = (variant.version ?? 0) + 1;

    // Promotion is not a local change. The server demotes whichever wording
    // was primary and re-sorts the list primary-first, while the response
    // carries only the variant that was written — which is exactly why
    // `usePatchVariant` refetches on this write instead of merging.
    if (body.primary) {
      const atom = findAtom(id)!;

      // B-034: the demote is a write, so the row it demotes is versioned too —
      // and only that row. The atom's other wordings take no part in the
      // promotion and keep their etags. Reproduced here because a client that
      // bumped all of them, or none, would pass against a mock that did the
      // same and then 412 against the server for reasons no test showed.
      const demoted = atom.variants?.find((other) => other.primary && other.id !== variantId);
      if (demoted) demoted.version = (demoted.version ?? 0) + 1;

      for (const other of atom.variants ?? []) other.primary = other.id === variantId;
      atom.variants?.sort((a, b) => Number(b.primary) - Number(a.primary));
    }

    return HttpResponse.json(variant, { headers: { ETag: `"${variant.version}"` } });
  }),

  /**
   * Deleting a section — **and everything under it.**
   *
   * The cascade is the server's and it is total, measured on a tree built for
   * the purpose: the entries go, the atoms under those entries go, and the
   * atoms hanging straight off the section go too. Nothing is re-parented.
   * Reproduced here rather than left as a one-row delete, because a mock that
   * removed only the section would leave orphans in the fixture and let a
   * confirmation that under-counts pass its tests.
   */
  http.delete('*/api/v1/profile/sections/:id', ({ request, params }) => {
    const id = String(params.id);
    const instance = `/api/v1/profile/sections/${id}`;
    const section = fixture.sections.find((candidate) => candidate.id === id);

    if (!section) {
      return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
    }

    const refused = precondition(request, instance, section.version ?? 0);
    if (refused) return refused;

    fixture.sections = fixture.sections.filter((candidate) => candidate.id !== id);
    fixture.entries = fixture.entries.filter((entry) => entry.sectionId !== id);
    fixture.atoms = fixture.atoms.filter((atom) => atom.sectionId !== id);

    return new HttpResponse(null, { status: 204 });
  }),

  /** Deleting an entry. Its atoms go with it, and are not handed back to the section. */
  http.delete('*/api/v1/profile/entries/:id', ({ request, params }) => {
    const id = String(params.id);
    const instance = `/api/v1/profile/entries/${id}`;
    const entry = fixture.entries.find((candidate) => candidate.id === id);

    if (!entry) {
      return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
    }

    const refused = precondition(request, instance, entry.version ?? 0);
    if (refused) return refused;

    fixture.entries = fixture.entries.filter((candidate) => candidate.id !== id);
    fixture.atoms = fixture.atoms.filter((atom) => atom.entryId !== id);

    return new HttpResponse(null, { status: 204 });
  }),

  http.delete('*/api/v1/profile/atoms/:id', ({ request, params }) => {
    const id = String(params.id);
    const instance = `/api/v1/profile/atoms/${id}`;
    const atom = findAtom(id);

    if (!atom) {
      return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
    }

    const refused = precondition(request, instance, atom.version ?? 0);
    if (refused) return refused;

    fixture.atoms = fixture.atoms.filter((candidate) => candidate.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),

  /**
   * Deleting a wording. **Two rules, not one** — our first measurement read
   * them as one because it only logged the status, and `B-036` corrected it.
   * The distinction is the whole point: the two refusals want two different
   * offers from the screen.
   *
   * | Case | `params.fields` | What the client can do |
   * |---|---|---|
   * | the atom's last wording | `["variantId"]` | delete the atom instead |
   * | primary, others exist | `["primary"]` | promote another one first |
   *
   * Nothing in the editor offers this yet; the handler exists so both
   * refusals are on record where that control will be written.
   */
  http.delete('*/api/v1/profile/atoms/:id/variants/:variantId', ({ request, params }) => {
    const id = String(params.id);
    const variantId = String(params.variantId);
    const instance = `/api/v1/profile/atoms/${id}/variants/${variantId}`;
    const atom = findAtom(id);
    const variant = atom?.variants?.find((candidate) => candidate.id === variantId);

    if (!variant) {
      return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
    }

    const refused = precondition(request, instance, variant.version ?? 0);
    if (refused) return refused;

    const isLast = (atom!.variants ?? []).length === 1;

    if (isLast || variant.primary) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], {
          fields: [isLast ? 'variantId' : 'primary'],
        }),
        { status: 400 },
      );
    }

    atom!.variants = atom!.variants?.filter((candidate) => candidate.id !== variantId);
    return new HttpResponse(null, { status: 204 });
  }),
];
