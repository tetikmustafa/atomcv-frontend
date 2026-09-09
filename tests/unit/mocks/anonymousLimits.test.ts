import { describe, expect, it } from 'vitest';
import { api } from '@/lib/api/client';
import { ApiError, isApiError } from '@/lib/api/errors';
import { importCv } from '@/lib/api/endpoints/profile';
import { createAtom, listAtoms, patchAtom } from '@/lib/api/endpoints/profile';
import { requireChallenge } from '@/mocks/authFixture';
import { generations } from '@/mocks/generationFixture';
import { fixture } from '@/mocks/profileFixture';
import { limitAtomsTo, signIn } from '@/mocks/sessionFixture';
import type { components } from '@/types/api';

type AcceptedJob = components['schemas']['AcceptedJobResponse'];
type GenerationResponse = components['schemas']['GenerationResponse'];

/**
 * What an anonymous session may do, and what it is refused (§ 35.7.2-35.7.4).
 *
 * The three handoff items behind this file all say the same thing in
 * different places: the limits `capabilities` has published all along are now
 * **enforced**, so a screen that was gating itself politely and a screen that
 * was not looked identical until `B-081`, `B-082` and `B-083` landed. These
 * are tests of the mock, and worth writing for the reason the generation
 * suite gives: the mock is the contract three environments share, so a drift
 * here reaches development and every screen at once.
 */

async function refusal(promise: Promise<unknown>): Promise<ApiError> {
  const caught = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!isApiError(caught)) throw new Error('expected an ApiError');
  return caught;
}

function file(name = 'cv.pdf', contents = 'a readable CV') {
  return new File([contents], name, { type: 'application/pdf' });
}

describe('the atom controls without an account', () => {
  /**
   * `B-081`: `importance`, `active`, `alwaysInclude` and `verbatim` are an
   * account's. `params.feature` says which door was tried, so the screen can
   * name the control rather than putting up a general wall.
   */
  it('refuses a patch that touches one, and names the feature', async () => {
    const [atom] = await listAtoms();

    const error = await refusal(patchAtom(atom!.id!, { importance: 0.9 }, atom!.version!));

    expect(error.status).toBe(403);
    expect(error.code).toBe('FEATURE_REQUIRES_ACCOUNT');
    expect(error.params?.feature).toBe('atom_controls');
    // Rule 7: the way out is the server's to name, and the client renders it.
    expect(error.resolutions.map((resolution) => resolution.action)).toEqual(['sign_up']);
  });

  /**
   * **Whole, not partially.** A patch carrying a control and a list is
   * rejected outright — a server that dropped the control and saved the rest
   * would be worse than a refusal, because half of what the reader changed
   * would disappear without a word.
   */
  it('rejects the whole patch rather than the offending field', async () => {
    const [atom] = await listAtoms();
    const before = atom!.skills;

    await refusal(
      patchAtom(atom!.id!, { importance: 0.9, skills: ['kubernetes'] }, atom!.version!),
    );

    const [after] = await listAtoms();
    expect(after!.skills).toEqual(before);
    expect(after!.version).toBe(atom!.version);
  });

  it('leaves everything else about the atom editable', async () => {
    const [atom] = await listAtoms();

    const updated = await patchAtom(atom!.id!, { skills: ['kubernetes'] }, atom!.version!);

    expect(updated.skills).toEqual(['kubernetes']);
  });
});

describe('the sixtieth atom', () => {
  /**
   * `B-081`: a `422` rather than a `403`, because nothing about the request
   * is forbidden — the profile is full. Both numbers travel so the sentence
   * can be "sixty of sixty" instead of "too many".
   */
  it('is the last one an anonymous profile takes', async () => {
    limitAtomsTo(fixture.atoms.length);

    const error = await refusal(
      createAtom({
        sectionId: fixture.sections[0]!.id!,
        kind: 'bullet',
        content: { runs: [{ t: 'One more', m: [] }] },
      }),
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe('ATOM_LIMIT_EXCEEDED');
    expect(error.params).toMatchObject({
      limit: fixture.atoms.length,
      current: fixture.atoms.length,
    });
  });

  it('is not a ceiling an account has at all', async () => {
    signIn();
    limitAtomsTo(0);

    const created = await createAtom({
      sectionId: fixture.sections[0]!.id!,
      kind: 'bullet',
      content: { runs: [{ t: 'One more', m: [] }] },
    });

    expect(created.id).toBeDefined();
  });
});

describe('skills as they are stored', () => {
  /**
   * `B-077`: the column is read as a **key**, so the server canonicalises on
   * write and answers with the stored form. The screen has to redraw from the
   * response rather than from what it sent.
   */
  it('comes back canonical rather than as it was sent', async () => {
    signIn();
    const [atom] = await listAtoms();

    const updated = await patchAtom(atom!.id!, { skills: ['Spring Boot'] }, atom!.version!);

    expect(updated.skills).toEqual(['spring-boot']);
  });

  it('comes back shorter when two spellings are one skill', async () => {
    signIn();
    const [atom] = await listAtoms();

    const updated = await patchAtom(
      atom!.id!,
      { skills: ['PostgreSQL', 'postgres', 'Go'] },
      atom!.version!,
    );

    expect(updated.skills).toEqual(['postgres', 'go']);
  });

  it('canonicalises on the way in as well as on the way through', async () => {
    const created = await createAtom({
      sectionId: fixture.sections[0]!.id!,
      kind: 'bullet',
      content: { runs: [{ t: 'Ran the database', m: [] }] },
      skills: ['PostgreSQL'],
    });

    expect(created.skills).toEqual(['postgres']);
  });
});

describe('a generation without an account', () => {
  it('is allowed, and is the same request an account makes', async () => {
    const job = await api.post<AcceptedJob>('/generations', {
      acknowledgePreflight: false,
      coverLetter: false,
    });

    expect(job.jobId).toBeDefined();
  });

  /**
   * `B-082`: refused **before the quota gate**, so the reader loses a round
   * trip rather than one of their five.
   */
  it('refuses the covering letter without spending a generation', async () => {
    const spent = generations.usage.generation;

    const error = await refusal(
      api.post('/generations', { acknowledgePreflight: false, coverLetter: true }),
    );

    expect(error.status).toBe(403);
    expect(error.code).toBe('FEATURE_REQUIRES_ACCOUNT');
    expect(error.params?.feature).toBe('cover_letter');
    expect(generations.usage.generation).toBe(spent);
  });

  it('reports no verdict on what it made, because a verdict needs an account', async () => {
    const job = await api.post<AcceptedJob>('/generations', {
      acknowledgePreflight: false,
      coverLetter: false,
    });
    const generationId = generations.jobs.find(
      (candidate) => candidate.jobId === job.jobId,
    )!.generationId;

    const generation = await api.get<GenerationResponse>(`/generations/${generationId}`);

    expect(generation.feedback).toBeUndefined();
  });
});

describe('the challenge on the two anonymous requests that cost money', () => {
  /**
   * `B-083`. Off unless a test asks for production, which is the local
   * deployment: without a Turnstile secret the server lets the request
   * through. That is exactly why "it worked locally" is not evidence the
   * field is being sent.
   */
  it('lets a tokenless generation through where it is not configured', async () => {
    const job = await api.post<AcceptedJob>('/generations', {
      acknowledgePreflight: false,
      coverLetter: false,
    });

    expect(job.jobId).toBeDefined();
  });

  it('refuses a generation with no token where it is', async () => {
    requireChallenge();

    const error = await refusal(
      api.post('/generations', { acknowledgePreflight: false, coverLetter: false }),
    );

    expect(error.status).toBe(403);
    expect(error.code).toBe('CHALLENGE_FAILED');
  });

  it('accepts a generation that carries one, and refuses the same token twice', async () => {
    requireChallenge();

    const job = await api.post<AcceptedJob>('/generations', {
      acknowledgePreflight: false,
      coverLetter: false,
      challengeToken: 'a-fresh-token',
    });
    expect(job.jobId).toBeDefined();

    // Single-use, which is why every screen resets the widget after an
    // attempt rather than only after a refusal.
    const error = await refusal(
      api.post('/generations', {
        acknowledgePreflight: false,
        coverLetter: false,
        challengeToken: 'a-fresh-token',
      }),
    );
    expect(error.code).toBe('CHALLENGE_FAILED');
  });

  it('refuses an import with no token, without spending the allowance', async () => {
    requireChallenge();
    const spent = generations.usage.profile_extract;

    const error = await refusal(importCv(file(), { idempotencyKey: crypto.randomUUID() }));

    expect(error.status).toBe(403);
    expect(error.code).toBe('CHALLENGE_FAILED');
    // The quota gate takes a unit even when it refuses (`B-040`), so a
    // request that never proved there was a person behind it must not reach
    // it.
    expect(generations.usage.profile_extract).toBe(spent);
  });

  it('accepts an import that carries one, as a form field', async () => {
    requireChallenge();

    const accepted = await importCv(file(), {
      idempotencyKey: crypto.randomUUID(),
      challengeToken: 'a-fresh-token',
    });

    expect(accepted.jobId).toBeDefined();
  });

  it('asks nothing of an account, which answered one to sign in', async () => {
    requireChallenge();
    signIn();

    const job = await api.post<AcceptedJob>('/generations', {
      acknowledgePreflight: false,
      coverLetter: false,
    });

    expect(job.jobId).toBeDefined();
  });
});
