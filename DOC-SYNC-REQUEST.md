# Doc sync request — from the frontend, after binding to the published schema

Written 2026-08-15, after `npm run gen:api` ran against the live Stage 1 API
and the frontend was rebound to the generated types.

Same round-trip as the last two: these are proposals for `docs/`, not edits.
Fold the ones you accept into EK D and delete this file. Nothing here blocks
frontend work — every item has already been handled defensively on this side,
and each says how.

The frontend commits this covers: `8b75f3b`, `7194a5e`, `7c3a31e`.

---

## A. Corrections to the specification

### A.1 — XI-B.9.2 step 4 cannot happen as written

**It says:** delete `src/mocks/contracts.ts` once `npm run gen:api` works.

**What is true:** `gen:api` works, and none of the file can go. It assumed the
schema would cover the mocked surface. The published schema is Stage 1 —
fifteen paths, all profile CRUD plus the synchronous `/generations/general`.
Every endpoint the mocks cover is Stage 2 or 3:

| Mocked                      | In the schema | Stage |
| --------------------------- | ------------- | ----- |
| `GET /auth/session`         | no            | 3     |
| `POST /generations` (async) | no            | 2     |
| `GET /jobs/{id}`            | no            | 2     |
| `GET /jobs/{id}/stream`     | no            | 2     |

Deleting it would not remove a mirror; it would leave the mocks untyped, which
is strictly worse than a scaffolding file that says what it is.

**Proposed wording:** the file empties **per type, as each endpoint is
published**, not in one step. The invariant that matters is narrower and
checkable: _nothing in `contracts.ts` may describe an endpoint the schema
already carries._ The error envelope has already moved out under that rule.

**Frontend state:** narrowed, with the reasoning in its header comment and in
CLAUDE.md. No action needed on this side.

---

## B. Schema completeness

Three places where the published schema says less than the API actually
promises. All three are `@Schema` annotations rather than behaviour changes.

The reason to care is mechanical: the generated client can only see what the
schema declares. An undeclared guarantee is one nobody can rely on and one
that can be removed without a single test going red on either side.

### B.1 — `ApiError.code` and `.status` are optional

springdoc marks nothing on `ApiError` as required, so the generated type is
`code?: ErrorCode`. EK D.9 · 12 guarantees the opposite: every error carries a
code, `INTERNAL_ERROR` included, precisely so the client's error path always
works.

As published, every consumer must branch on a case the contract says cannot
occur — and the branch is untestable, because the server will not produce it.

**Proposed:** mark `code` and `status` required. `title`, `type`, `instance`,
`params` and `resolutions` are genuinely optional; `params` is correctly
absent rather than `{}` when a code declares none, which is worth keeping.

**Frontend state:** `ProblemDetail` in `src/types/domain.ts` re-requires both,
and `toApiError` supplies them for a body that arrives without them.

### B.2 — the `ETag` response header is undeclared on writes

Declared on `GET /profile`, `PUT /profile` and `PUT /preferences`. Not on any
`POST` or `PATCH`, and not on the collection `GET`s.

The behaviour is right — `PATCH /profile/atoms/{id}` answers `200` with both
`ETag: "1"` and `version: 1` in the body, so autosave never needs a read
between saves. That is exactly the guarantee the profile editor is built on,
and it is currently invisible to the schema.

**Proposed:** declare `ETag` on every single-resource write response. The
collection `GET`s do not need one and should not have one — they carry
`version` per item, which is what D.6 promised and what the editor uses.

**Frontend state:** verified by hand against the running server and recorded
in CLAUDE.md. The editor will read the body's `version`, which is declared,
so this is about making the contract match reality rather than unblocking us.

### B.3 — `Run.m` is optional while EK D.2 says it never is

`Content.runs[].m` is `m?: string[]` in the schema. D.9 · 4 says the opposite:
"`m` is always an array. Even an unmarked run carries `"m": []`, so
`undefined` checks are noise." The running server agrees with the docs — every
run in every seeded atom carries `m`, `[]` when unmarked.

Since `Content` is one schema for both reads and writes, the optionality is
presumably there so a writer may leave `m` out. That is a good thing to allow,
but it means the read guarantee is unstated.

**Proposed:** either mark `m` required and let writers send `[]`, or keep it
optional and add a line to D.2 saying the _server_ always emits it while a
client may omit it. Either is fine; the two documents currently contradict
each other, which is the only real problem.

`Content.v` has the same shape and does not need fixing: server-owned, omitted
on write, and the schema description already says so.

**Frontend state:** `richContent.ts` accepts both. A missing `m` becomes `[]`
on parse, which is what makes D.9 · 4 true for everything downstream; a
missing `v` is left missing rather than invented. A non-array `m` or a
non-numeric `v` still throws, because those mean the field was repurposed.

---

## C. For EK D.9, if you want them there

Two things the running API settled that a frontend session would otherwise
have to rediscover by experiment. Neither is a change request.

### C.1 — atom and variant versions move independently

`PATCH /profile/atoms/{id}` bumps the atom's `version` and leaves each
variant's own `version` untouched. Correct — the controls and the wording are
separately editable — but it means the editor holds two versions per atom, not
one, and an `If-Match` built from the wrong one fails in a way that looks like
a concurrency bug.

### C.2 — the error paths behave exactly as specified

Verified end to end, so D.6 can be trusted here without re-testing:

- stale `If-Match` → `412`, `code: VERSION_CONFLICT`, one `retry` resolution
- missing `If-Match` → `428`, `code: PRECONDITION_REQUIRED`, no resolutions
- `type` is relative (`/errors/version-conflict`)
- `params` is absent, not `{}`, when the code declares none
- collection `GET`s return a bare JSON array with `version` per item, no ETag
- `kind`, `layout`, `source`, `created_by` and `tone` all travel lowercase

This one caught a bug on our side rather than yours: the 409 mock was sending
an absolute `type` URL. Fixed in `8b75f3b`.
