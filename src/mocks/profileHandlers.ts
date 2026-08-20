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
import { fixture, type MockAtom } from './profileFixture';

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

  http.get('*/api/v1/profile/sections', () => HttpResponse.json(fixture.sections)),

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
      for (const other of atom.variants ?? []) other.primary = other.id === variantId;
      atom.variants?.sort((a, b) => Number(b.primary) - Number(a.primary));
    }

    return HttpResponse.json(variant, { headers: { ETag: `"${variant.version}"` } });
  }),
];
