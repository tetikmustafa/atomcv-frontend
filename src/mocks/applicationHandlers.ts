/**
 * The application tracker (§ 55, `B-093`).
 *
 * What these encode is behaviour, not sample rows:
 *
 * - **no pagination** — the endpoint answers with the whole list, so a screen
 *   written against a cursor would find none here either;
 * - **`If-Match` is required on both writes**, and the two refusals are the
 *   ones § 35.6 names: missing is `428`, stale is `412`;
 * - **`PATCH` is partial**, and `notes: null` means "leave them alone" while
 *   `clearNotes: true` empties them — one value cannot mean both;
 * - **somebody else's `generationId` is a `400`, not a `404`**: the field is
 *   wrong rather than the row missing;
 * - **a `generationId` that becomes null means the CV was deleted**, and the
 *   row survives it.
 */

import { http, HttpResponse } from 'msw';
import type { Application } from '@/lib/api/endpoints/applications';
import { generations } from './generationFixture';
import { problem } from './problem';
import { isAccount } from './sessionFixture';

const APPLICATIONS = '/api/v1/applications';

/**
 * The rows, newest first. Module state like every other fixture, and reset
 * between tests for the same reason.
 */
export let applications: Application[] = [];

export function resetApplications() {
  applications = [];
}

/** Every endpoint here needs an account: a record of applying outlives a session. */
function requireAccount(instance: string) {
  if (isAccount()) return undefined;

  return HttpResponse.json(problem(401, 'AUTHENTICATION_REQUIRED', instance), { status: 401 });
}

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

/** Today, as a date rather than an instant: the column is a `DATE`. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

export const applicationHandlers = [
  http.get(`*${APPLICATIONS}`, () => {
    const refused = requireAccount(APPLICATIONS);
    if (refused) return refused;

    // Newest first, and all of it. There is no `limit` to read and no cursor
    // to hand back — a client that sent one would be describing an endpoint
    // that does not exist.
    return HttpResponse.json(applications);
  }),

  http.post(`*${APPLICATIONS}`, async ({ request }) => {
    const refused = requireAccount(APPLICATIONS);
    if (refused) return refused;

    const body = (await request.json()) as Partial<Application>;
    const missing = [
      ...(body.company?.trim() ? [] : ['company']),
      ...(body.position?.trim() ? [] : ['position']),
    ];

    if (missing.length > 0) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', APPLICATIONS, [], { fields: missing }),
        { status: 400 },
      );
    }

    /*
      Somebody else's generation is a **400** naming the field, not a 404:
      the row the caller asked to create is not missing, the value they put in
      it is wrong. Anything the fixture has not made counts as somebody
      else's, which is the only version of "not yours" a mock can have.
    */
    if (
      body.generationId &&
      !generations.jobs.some((job) => job.generationId === body.generationId)
    ) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', APPLICATIONS, [], { fields: ['generationId'] }),
        { status: 400 },
      );
    }

    const created: Application = {
      id: crypto.randomUUID(),
      company: body.company!.trim(),
      position: body.position!.trim(),
      // Omitted means `applied` and today, which is what somebody who has
      // just pressed the button means.
      status: body.status ?? 'applied',
      appliedAt: body.appliedAt ?? today(),
      ...(body.generationId ? { generationId: body.generationId } : {}),
      ...(body.notes ? { notes: body.notes } : {}),
      createdAt: new Date().toISOString(),
      version: 0,
    };

    applications = [created, ...applications];

    return HttpResponse.json(created, {
      status: 201,
      headers: {
        Location: `${APPLICATIONS}/${created.id}`,
        // Both, as the real endpoint sends them: the header for the next
        // write, and the same number in the body for a client that reads
        // rows rather than responses.
        ETag: `"${created.version}"`,
      },
    });
  }),

  http.patch(`*${APPLICATIONS}/:applicationId`, async ({ params, request }) => {
    const id = String(params.applicationId);
    const instance = `${APPLICATIONS}/${id}`;

    const refused = requireAccount(instance);
    if (refused) return refused;

    const row = applications.find((candidate) => candidate.id === id);
    if (!row) {
      return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
    }

    const stale = precondition(request, instance, row.version!);
    if (stale) return stale;

    const body = (await request.json()) as Partial<Application> & { clearNotes?: boolean };

    if (
      body.generationId &&
      !generations.jobs.some((job) => job.generationId === body.generationId)
    ) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', instance, [], { fields: ['generationId'] }),
        { status: 400 },
      );
    }

    /*
      Merged, not assigned: an omitted field is left alone. That is what lets
      a screen move a row from `applied` to `interview` without sending the
      notes back and overwriting an edit made in another tab.

      `clearNotes` is the only way to empty them, because `notes: null`
      already means "leave them" everywhere in this API.
    */
    const updated: Application = {
      ...row,
      ...(body.company !== undefined ? { company: body.company } : {}),
      ...(body.position !== undefined ? { position: body.position } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.appliedAt !== undefined ? { appliedAt: body.appliedAt } : {}),
      ...(body.generationId !== undefined ? { generationId: body.generationId } : {}),
      ...(body.notes !== undefined && body.notes !== null ? { notes: body.notes } : {}),
      version: row.version! + 1,
    };

    if (body.clearNotes) delete updated.notes;

    applications = applications.map((candidate) => (candidate.id === id ? updated : candidate));

    return HttpResponse.json(updated, { headers: { ETag: `"${updated.version}"` } });
  }),

  http.delete(`*${APPLICATIONS}/:applicationId`, ({ params, request }) => {
    const id = String(params.applicationId);
    const instance = `${APPLICATIONS}/${id}`;

    const refused = requireAccount(instance);
    if (refused) return refused;

    const row = applications.find((candidate) => candidate.id === id);
    if (!row) {
      return HttpResponse.json(problem(404, 'RESOURCE_NOT_FOUND', instance), { status: 404 });
    }

    const stale = precondition(request, instance, row.version!);
    if (stale) return stale;

    // The record of applying goes; the CV is untouched, which is the whole
    // difference between this and deleting a generation.
    applications = applications.filter((candidate) => candidate.id !== id);

    return new HttpResponse(null, { status: 204 });
  }),
];

/**
 * What happens to a row when the resume it points at is deleted
 * (`ON DELETE SET NULL`).
 *
 * A test button, like `limitAtomsTo`: nothing in the mock deletes a
 * generation, and the state worth exercising is the row that **survives** one
 * — it keeps its place and loses its download.
 */
export function forgetGenerationOf(applicationId: string) {
  applications = applications.map((row) =>
    row.id === applicationId ? { ...row, generationId: undefined } : row,
  );
}
