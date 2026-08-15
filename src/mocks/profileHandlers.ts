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
): ProblemDetail {
  return {
    type: `/errors/${code.toLowerCase().replaceAll('_', '-')}`,
    title: code,
    status,
    instance,
    code,
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

  /** Unpaginated, and the only source of per-atom versions. */
  http.get('*/api/v1/profile/atoms', ({ request }) => {
    const filter = new URL(request.url).searchParams;
    const sectionId = filter.get('sectionId');
    const entryId = filter.get('entryId');

    return HttpResponse.json(
      fixture.atoms.filter(
        (atom) =>
          (!sectionId || atom.sectionId === sectionId) && (!entryId || atom.entryId === entryId),
      ),
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

    const body = (await request.json()) as { content: NonNullable<typeof variant.content> };
    variant.content = body.content;
    variant.plainText = (body.content.runs ?? []).map((run) => run.t).join('');
    variant.version = (variant.version ?? 0) + 1;

    return HttpResponse.json(variant, { headers: { ETag: `"${variant.version}"` } });
  }),
];
