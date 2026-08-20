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
import type { ProblemDetail } from '@/types/domain';
import {
  fixture,
  type MockAtom,
  type MockEntry,
  type MockProfile,
  type MockSection,
} from './profileFixture';

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

function problem(
  status: number,
  code: string,
  instance: string,
  resolutions: ProblemDetail['resolutions'] = [],
  params?: Record<string, unknown>,
): ProblemDetail {
  return {
    type: `/errors/${code.toLowerCase().replaceAll('_', '-')}`,
    title: code,
    status,
    instance,
    code,
    // Absent rather than `{}` when a code declares none, as the real API does.
    ...(params ? { params } : {}),
    ...(resolutions.length ? { resolutions } : {}),
  };
}

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

    if (!body.enabledLanguages || body.enabledLanguages.length === 0) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['enabledLanguages'] }),
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

    // Assigned, not merged: what is not sent is gone.
    fixture.profile = {
      ...fixture.profile,
      headline: body.headline ?? undefined,
      contact: body.contact ?? {},
      selfDescription: body.selfDescription ?? undefined,
      sourceLanguage: body.sourceLanguage ?? fixture.profile.sourceLanguage,
      enabledLanguages: body.enabledLanguages,
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
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['endDate'] }),
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
    };

    const runs = body.content?.runs ?? [];
    if (!body.sectionId || !body.kind || runs.length === 0) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['content'] }),
        { status: 400 },
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
      skills: [],
      metrics: [],
      properNouns: [],
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
    Object.assign(atom, patch, { version: (atom.version ?? 0) + 1 });

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
    };

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
];
