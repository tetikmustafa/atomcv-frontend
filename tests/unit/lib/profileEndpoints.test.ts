import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, isApiError } from '@/lib/api/errors';
import {
  getProfile,
  listAtoms,
  patchAtom,
  patchVariant,
  reorderAtoms,
} from '@/lib/api/endpoints/profile';
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
 * `application/json`, and now for a stated reason rather than only because
 * the server accepted it.
 *
 * Bölüm 35.6 used to specify `application/merge-patch+json`; that was an
 * error, corrected in the third doc round. Only `EntryPatch` implements RFC
 * 7396's semantics — elsewhere `null` means "leave alone" because the columns
 * cannot be null — so declaring the registered type would have been a false
 * claim in the contract. A client that sends it now gets **415**; it used to
 * get 500, which told the user the server had broken.
 *
 * Pinned so a well-meaning correction back toward the old prose is caught here
 * rather than by every save in the editor failing.
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

/**
 * A body-less success that does not announce itself as 204, with no
 * `Content-Length` to prove it either — a worker-served or chunked response
 * can carry neither. `response.json()` then throws a bare SyntaxError from
 * outside the fetch try/catch, which surfaced in the browser as an uncaught
 * error rather than as a failed request.
 *
 * This used to name the reorder endpoints as the case in point, on the
 * strength of a mock. They are not: the server answers those with the
 * reordered collection, pinned below. The guard is kept because the hazard is
 * about the shape of the response, not about which endpoint sends it — hence
 * the handler here is stated outright rather than borrowed.
 */
describe('a response with no body', () => {
  it('is read as nothing rather than as broken JSON', async () => {
    server.use(
      http.post('*/api/v1/profile/atoms/reorder', () => new HttpResponse(null, { status: 200 })),
    );

    await expect(reorderAtoms('sec-experience', ['atom-1', 'atom-2'])).resolves.toBeUndefined();
  });

  it('still reports a body that is genuinely malformed', async () => {
    server.use(
      http.get('*/api/v1/profile/atoms', () => new HttpResponse('{oh no', { status: 200 })),
    );

    await expect(listAtoms()).rejects.toThrow();
  });
});

/**
 * What reorder actually answers with, measured against the running backend and
 * encoded here so the mock cannot drift back.
 *
 * The client was typed `void` for this call until the endpoint functions were
 * bound to the generated `operations`, which is the whole argument for that
 * binding: nothing failed, because a response nobody reads cannot disagree
 * with a type nobody checks.
 *
 * The scope matters as much as the shape — the answer covers the group that
 * was reordered, not the section around it, so `useReorderAtoms` still has to
 * invalidate rather than write this through.
 */
describe('reordering', () => {
  it('answers with the reordered group, renumbered', async () => {
    const reordered = await reorderAtoms('sec-experience', ['atom-2', 'atom-1']);

    expect(reordered.map((atom) => atom.id)).toEqual(['atom-2', 'atom-1']);
    expect(reordered.map((atom) => atom.displayOrder)).toEqual([0, 1]);
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
