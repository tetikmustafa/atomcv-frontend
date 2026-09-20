/**
 * `POST /profile/import` — a CV in, a job out (`B-051`).
 *
 * The behaviour worth mocking is the **order of the gates**, because every
 * one of them produces a different screen and § 31.2 puts them cheapest
 * first: what the file is called, how big it is, and only then what is inside
 * it. Getting that order wrong is invisible until a 12 MB PNG is refused for
 * being a PNG and the reader shrinks it.
 *
 * Three of the checks are keyed on the **file name**, and that is a limit of
 * a mock rather than a shape of the API: nothing here can parse a PDF to find
 * out whether it is encrypted, a scan, or written in a language the model
 * cannot place. The extension, the size and the emptiness checks are the real
 * rules, applied to the real file.
 */

import { http, HttpResponse } from 'msw';
import { challengeRefused } from './authFixture';
import { generations, type MockImportJob, type MockImportOutcome } from './generationFixture';
import type { FailedEvent } from './contracts';
import { accepted, resetsAt } from './generationHandlers';
import { problem } from './problem';
import { fixture } from './profileFixture';
import { currentQuota, isAccount } from './sessionFixture';

const IMPORT = '/api/v1/profile/import';

/**
 * The list the server owns, published in the `415` (`B-051`).
 *
 * Nothing on the client side embeds it — the file picker filters on nothing
 * — so this is the only place it exists, which is the arrangement the item
 * asks for: a format added server-side corrects the message without waiting
 * for a frontend release.
 */
const ACCEPTED = ['pdf', 'docx', 'tex', 'txt', 'md'];

/** `spring.servlet.multipart.max-file-size`, as § 31.6.1 reads it. */
const LIMIT_BYTES = 10 * 1024 * 1024;

function extensionOf(name: string) {
  // No locale: an extension is a wire token, and under `tr` an uppercase `I`
  // folds to a dotless `ı` (rule 11).
  return name.toLowerCase().split('.').pop() ?? '';
}

/**
 * The `language` gate (`B-119`): every ISO 639-1 code the runtime knows, and
 * nothing else.
 *
 * The server checks against the codes **the JDK** knows, so the two lists are
 * not guaranteed to be the same list — what the mock reproduces is the
 * behaviour the client is written against: a code nobody knows is refused,
 * loudly, rather than ignored. Ignoring it is the thing `B-119` rules out,
 * because an ignored declaration is written into the profile as its language
 * and every generation after it is made in a language that does not exist.
 *
 * `fallback: 'none'` is what makes this a test rather than an echo —
 * `DisplayNames` otherwise hands back the code it was given.
 */
function knownLanguage(code: string) {
  // `toLowerCase`, never `toLocaleLowerCase` (rule 11).
  const normalised = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(normalised)) return false;

  try {
    return (
      new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' }).of(normalised) !==
      undefined
    );
  } catch {
    return false;
  }
}

/**
 * What extraction reports back, counted off the profile the mock already
 * holds.
 *
 * Counted rather than invented so the review screen's numbers and the profile
 * it then shows cannot disagree — a screen saying "24 items" above a list of
 * four is a bug this fixture would otherwise create.
 */
function importResult(declared?: string): MockImportOutcome {
  /*
    Two warnings, and the pair is the point (`B-067`): one that names a place
    and one that names none. The review screen has to open a section for the
    first and count the second without opening anything, and a fixture with
    only the located kind would let the second half go unbuilt.

    Real codes since `B-069` published the vocabulary — the six are the
    server's, not a guess. The located one is § 31.6.4's own example resolved
    against this fixture: `sectionOrder: 0` is Experience, `entryOrder: 1`
    its second job. The other is document-level, which is the shape the model
    produces for something it removed without being able to place.
  */
  const warnings: MockImportOutcome['warnings'] = [
    { code: 'ambiguous_date', sectionOrder: 0, entryOrder: 1 },
    { code: 'untranslatable_atom' },
  ];

  return {
    profileId: 'profile-1',
    sectionCount: fixture.sections.length,
    atomCount: fixture.atoms.length,
    // The server's own promise: the same number as `warnings.length`.
    warningCount: warnings.length,
    // A declared language is not detected, it is taken (`B-119`). The field
    // still reports what the profile ended up in, which is the answer the
    // reader gave — the review screen says "read as Turkish" either way, and
    // whether a model or a person decided that is not its question.
    detectedLanguage: declared ?? fixture.profile.sourceLanguage,
    warnings,
  };
}

export const importHandlers = [
  http.post('*/api/v1/profile/import', async ({ request }) => {
    // Idempotency first, as on `POST /generations`: the same key means the
    // caller asked for one import and one exists (§ 30.7). An upload is the
    // request a bad connection retries most readily, and this allowance is
    // the smallest in the product.
    const key = request.headers.get('Idempotency-Key');
    const existing = key ? generations.jobs.find((job) => job.idempotencyKey === key) : undefined;
    if (existing) return accepted(existing);

    const form = await request.formData();

    /*
      § 35.7.4's challenge (`B-083`), and it is read out of the **multipart
      body** rather than a header — a form field beside the file.

      Ahead of the quota gate below on purpose: that gate spends a unit even
      when it refuses (`B-040`), and a request that never proved there was a
      person behind it must not be able to spend anybody's three-a-day.

      Anonymous only. An account answered a challenge when it signed in
      (§ 40.4.1), and a token it sends anyway is ignored.
    */
    const challengeToken = form.get('challengeToken');

    if (
      !isAccount() &&
      challengeRefused(typeof challengeToken === 'string' ? challengeToken : undefined)
    ) {
      return HttpResponse.json(problem(403, 'CHALLENGE_FAILED', IMPORT), { status: 403 });
    }

    const quota = currentQuota().profile_extract;

    if (generations.usage.profile_extract >= quota) {
      const at = resetsAt();
      // The refusal takes a unit, exactly as the generation gate does
      // (`B-040`): without it, a caller past the limit could hammer the
      // endpoint for free.
      generations.usage.profile_extract += 1;

      return HttpResponse.json(
        problem(429, 'PROFILE_QUOTA_EXCEEDED', IMPORT, [], { limit: quota, resetsAt: at }),
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((Date.parse(at) - Date.now()) / 1000)) },
        },
      );
    }

    const part = form.get('file');

    /*
      Duck-typed rather than `instanceof File`. The class a multipart body is
      parsed back into belongs to whoever parsed it, which in a browser is the
      same one the page constructed and outside a browser need not be — and
      an `instanceof` that is wrong about that refuses every real upload.
      `FormData.get` only ever answers a string, a file, or nothing, so the
      question the handler actually has is answerable without the class.
    */
    const file = typeof part === 'string' ? null : part;

    if (!file) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', IMPORT, [], { fields: ['file'] }),
        {
          status: 400,
        },
      );
    }

    const declaredPart = form.get('language');
    const declared = typeof declaredPart === 'string' ? declaredPart.trim().toLowerCase() : '';

    /*
      **This order was measured, not derived** (2026-08-30, against the running
      backend). It is not the order § 31.2 reads in, and the difference is
      where each gate lives rather than what it costs:

        413 — Spring's own multipart limit, which fires before the controller
              is entered at all, so it beats every rule written inside one;
        400 — `language`, checked as the controller binds its parameters,
              which is still before it has looked at anything;
        409 — the profile check, which the controller reaches before it has
              looked at the file;
        415 and the 422s — the file's own gates.

      A mock keeping the tidier order would answer "unsupported format" to a
      12 MB PNG that production answers "too large" to, and the reader would
      shrink the wrong thing. Nothing below charges the allowance: § 31.6.1
      takes a unit at the gate and gives it back when nothing came out, and a
      file refused here produced nothing.
    */
    if (file.size > LIMIT_BYTES) {
      // The limit, never the size that was sent: Spring refuses an oversized
      // multipart before anything counts its bytes (`B-051`).
      return HttpResponse.json(
        problem(413, 'DOCUMENT_TOO_LARGE', IMPORT, [], { limitBytes: LIMIT_BYTES }),
        { status: 413 },
      );
    }

    /*
      `language` — the `choose_language` answer (`B-119`, § 31.6.1), and its
      place here **was measured** (2026-09-21, against the running backend,
      once the deployment carrying the field was up).

      Three probes, and the middle one is the reason this block moved: an
      11 MB upload with `language=zz` comes back `413`, a `.png` with the same
      `language=zz` comes back **`400` naming `language`** rather than `415`,
      and the same `.png` without it comes back `409`. So the declaration is
      checked where the controller binds its parameters — after Spring's
      multipart limit, before the profile and the format.

      It matters because each of those is a different screen. A mock refusing
      the `.png` for being a `.png` would have the client written against the
      wrong one of them, which is exactly what the 413/409/415 measurement
      behind this block found the first time (`B-051`).
    */
    if (declared !== '' && !knownLanguage(declared)) {
      return HttpResponse.json(
        problem(400, 'VALIDATION_FAILED', IMPORT, [], { fields: ['language'] }),
        { status: 400 },
      );
    }

    /*
      `B-060`. **Having a profile is not the test — having something in it
      is.** Everyone who signs in once gets an empty profile row, and a first
      upload has to pass.

      Only for an account: § 31.6.3 gives an anonymous caller a profile that
      is a single document with its own two-hour life, and nothing in the
      handoff asks for a conflict there.
    */
    const replacing = new URL(request.url).searchParams.get('mode') === 'replace';
    const hasContent = fixture.sections.length > 0;

    if (isAccount() && hasContent && !replacing) {
      return HttpResponse.json(
        problem(409, 'PROFILE_ALREADY_EXISTS', IMPORT, [
          { action: 'replace_profile' },
          { action: 'keep_existing_profile' },
        ]),
        { status: 409 },
      );
    }

    if (!ACCEPTED.includes(extensionOf(file.name))) {
      return HttpResponse.json(
        problem(415, 'UNSUPPORTED_DOCUMENT', IMPORT, [], { accepted: ACCEPTED }),
        { status: 415 },
      );
    }

    const name = file.name.toLowerCase();

    /*
      All three carry a way out since `B-114`, and they did not before: a
      sentence and no button, on the screen where somebody is already stuck.
      The mock produced the empty arrays faithfully, which is how a refusal
      with nowhere to go survived being looked at.

      `PDF_ENCRYPTED` gets `upload_another_file` rather than `retry` because
      the same locked file fails in the same place every time; the other two
      get `switch_to_manual_form`, which was in the vocabulary unused.
    */
    if (name.includes('encrypted')) {
      return HttpResponse.json(
        problem(422, 'PDF_ENCRYPTED', IMPORT, [{ action: 'upload_another_file' }]),
        { status: 422 },
      );
    }

    // § 31.10 separates these two here and only here, and the difference is
    // the sentence the reader gets: "this may be a scan" is what stops them
    // uploading the same file again.
    if (name.includes('scanned')) {
      return HttpResponse.json(
        problem(422, 'PDF_NOT_TEXT_BASED', IMPORT, [{ action: 'switch_to_manual_form' }]),
        { status: 422 },
      );
    }

    if (file.size === 0) {
      return HttpResponse.json(
        problem(422, 'EXTRACTION_EMPTY', IMPORT, [{ action: 'switch_to_manual_form' }]),
        { status: 422 },
      );
    }

    /*
      **The one refusal in here that a request can turn off** (`B-119`).

      It fails in the worker rather than at the gate, which is the whole shape
      of `F-037`: by the time the model cannot tell what the CV is written in,
      the `202` is long since answered and there is no half-written profile to
      put the answer on. So it arrives as a `failed` event carrying the
      server's one guess and the action that spends it.

      **A declared language skips detection**, so the same file uploaded again
      with `language` set gets through. Weighting the guess instead would let
      the second attempt land on the same refusal, which is the loop the item
      was raised about — and a mock that only nudged a threshold would let a
      client be written against a promise the server does not make.

      Keyed on the file name, like `encrypted` and `scanned` above and for the
      same reason: nothing here reads a document to find out.
    */
    const undetectable = name.includes('undetected') && declared === '';

    const languageFailure: FailedEvent = {
      code: 'LANGUAGE_UNDETECTED',
      // One candidate, never a menu: the question the screen then asks is
      // "this one, or another language?".
      params: { detectedCandidates: ['tr'] },
      resolutions: [{ action: 'choose_language' }],
    };

    const failure = undetectable ? languageFailure : generations.nextFailure;

    const job: MockImportJob = {
      jobId: `job-${generations.jobs.length + 1}`,
      kind: 'import',
      imported: importResult(declared === '' ? undefined : declared),
      startedAt: Date.now(),
      outcome: undetectable ? 'failed' : generations.nextOutcome,
      ...(failure ? { failure } : {}),
      ...(key ? { idempotencyKey: key } : {}),
    };

    generations.jobs.push(job);
    generations.nextOutcome = 'completed';
    generations.nextFailure = undefined;
    // Charged on enqueue and given back when the job fails (`B-039`, § 44.2);
    // the refund is in the stream, where the outcome is known.
    generations.usage.profile_extract += 1;

    return accepted(job);
  }),
];
