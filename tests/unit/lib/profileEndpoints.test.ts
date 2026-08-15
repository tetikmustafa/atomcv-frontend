import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, isApiError } from '@/lib/api/errors';
import { getProfile, listAtoms, patchAtom, patchVariant } from '@/lib/api/endpoints/profile';
import { server } from '@/mocks/node';

async function captured(promise: Promise<unknown>): Promise<ApiError> {
  const caught = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!isApiError(caught)) throw new Error('expected an ApiError');
  return caught;
}

/**
 * Bölüm 35.6 specifies `application/merge-patch+json`. The running backend
 * answers 500 to exactly that value and 200 to `application/json`, which is
 * also what the published schema declares on every PATCH. Following the prose
 * here would mean an editor that cannot save a single field, and the failure
 * arrives as INTERNAL_ERROR — a message blaming the server for the client's
 * header. Pinned so a well-meaning correction toward the spec is caught here.
 */
describe('the patch media type', () => {
  it('is application/json, which is what this API accepts', async () => {
    let seen: string | null = null;

    server.use(
      http.patch('*/api/v1/profile/atoms/:id', ({ request }) => {
        seen = request.headers.get('Content-Type');
        return HttpResponse.json({ id: 'atom-1', version: 1 });
      }),
    );

    await patchAtom('atom-1', { importance: 0.5 }, 0);

    expect(seen).toBe('application/json');
  });
});

describe('the profile head', () => {
  /**
   * `Profile` carries no version field, so the ETag is not a nicety here —
   * it is the only thing that makes the head editable at all.
   */
  it('comes back with the version a write to it must quote', async () => {
    const { data, version } = await getProfile();

    expect(data.completeness).toBe(80);
    expect(version).toBe('"1"');
  });
});

describe('atoms', () => {
  it('carry a version per item, so nothing needs a second read', async () => {
    const atoms = await listAtoms();

    expect(atoms).toHaveLength(2);
    expect(atoms.every((atom) => typeof atom.version === 'number')).toBe(true);
  });

  it('can be filtered without losing that', async () => {
    const atoms = await listAtoms({ sectionId: 'sec-experience' });

    expect(atoms.map((atom) => atom.id)).toEqual(['atom-1', 'atom-2']);
  });
});

/**
 * The three outcomes of a write, all checked against the real API first.
 * Getting the middle one by accident — through an unquoted header — is the
 * failure `toIfMatch` exists to prevent, so it is asserted rather than assumed.
 */
describe('optimistic concurrency', () => {
  it('accepts a write built on the current version and hands back the next one', async () => {
    const [atom] = await listAtoms();

    const updated = await patchAtom(atom!.id!, { importance: 0.9 }, atom!.version!);

    expect(updated.importance).toBe(0.9);
    expect(updated.version).toBe(atom!.version! + 1);
  });

  it('refuses a write built on a version that has moved', async () => {
    const [atom] = await listAtoms();
    await patchAtom(atom!.id!, { importance: 0.9 }, atom!.version!);

    const error = await captured(patchAtom(atom!.id!, { importance: 0.1 }, atom!.version!));

    expect(error.status).toBe(412);
    expect(error.code).toBe('VERSION_CONFLICT');
    // Rule 7: the way out is the server's to name, and the client renders it.
    expect(error.resolutions.map((resolution) => resolution.action)).toEqual(['retry']);
  });

  it('refuses a write that names no version at all', async () => {
    const [atom] = await listAtoms();

    // Reaches the client's own guard before a request is made — a missing
    // version cannot become a request that omits the header.
    await expect(patchAtom(atom!.id!, { importance: 0.1 }, undefined!)).rejects.toThrow(/ETag/);
  });

  /**
   * Atom and variant versions move independently, so an `If-Match` built from
   * the wrong one fails in a way that reads like a concurrency bug.
   */
  it('versions a variant separately from the atom that owns it', async () => {
    const [atom] = await listAtoms();
    const variant = atom!.variants![0]!;

    const bumped = await patchAtom(atom!.id!, { importance: 0.9 }, atom!.version!);
    expect(bumped.version).toBe(1);
    expect(bumped.variants![0]!.version).toBe(0);

    const rewritten = await patchVariant(
      atom!.id!,
      variant.id!,
      { content: { runs: [{ t: 'Rewritten', m: [] }] } },
      variant.version!,
    );

    expect(rewritten.version).toBe(1);
    expect(rewritten.plainText).toBe('Rewritten');
  });
});
