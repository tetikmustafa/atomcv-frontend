# Doc sync request — from the frontend, after binding to the published schema

Written 2026-08-15 and extended 2026-08-17, as the profile editor was built
and every claim in it was checked against the running backend through the dev
proxy — not read off the schema.

Same round-trip as the last two: these are proposals for `docs/`, not edits.
Fold the ones you accept into EK D and delete this file.

Two to read first:

- **A.2** is the only item that describes something broken rather than
  something unstated. Following the specification there produces an editor
  that cannot save a single field.
- **A.3** is a decision rather than a defect: Bölüm 37.6 draws controls that
  Stage 1 has no endpoint for, and the next session to read it will build
  them.

Everything else is handled defensively on this side already, and each item
says how.

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

### A.2 — the PATCH media type in Bölüm 35.6 does not work

**This one is behavioural, not annotation, and it is the only item here that
would have shipped a broken editor.**

Bölüm 35.6 specifies:

```http
PATCH /api/v1/profile/atoms/{id}
Content-Type: application/merge-patch+json
```

Sent exactly that way, the running backend answers **500 `INTERNAL_ERROR`**.
With `Content-Type: application/json` the same request answers 200. The
published schema agrees with the server: all four PATCH operations declare
`application/json`, and nothing anywhere declares the merge-patch type.

Two separate things to decide:

1. **Which is right.** Either the controllers should consume
   `application/merge-patch+json` — it is the registered type for these
   semantics (RFC 7396) and what the spec has always said — or Bölüm 35.6
   should stop naming it. The semantics are not in question either way:
   omitted keys are left alone and `null` clears, which is what the API does
   and what `buildPatch` is built around.
2. **A 500 is the wrong answer regardless.** An unsupported media type is
   `415`, and a 500 means something threw where a content negotiation failure
   belongs. It also misleads: the client's error panel tells the user the
   server broke, when the request never should have been accepted for
   processing.

While that is open the frontend follows the schema and sends
`application/json`, with a test pinning it — otherwise a well-meant
correction toward the spec silently breaks every save.

**One more thing in the same section:** the example reads
`If-Match: "v7"`. Real ETags carry no prefix (`"7"`), and the header is
compared literally — an unquoted or prefixed value answers 412, which is
indistinguishable from a genuine conflict. Worth fixing where someone might
copy it.

### A.3 — Bölüm 37.6 draws two buttons that nothing can answer

37.6 shows a stale wording with `[ Yeniden üret ] [ Benimkini koru ]`, and
`Variant.stale` is published with the description "the source has moved on;
this wording needs regenerating".

Stage 1 has **no endpoint that regenerates a variant**, and no background job
that would ever set `stale` in the first place — 37.5's chain (TR edited →
EN marked stale → translation job) is Stage 2 work. So today the flag is
always false, and if it were true there would be nothing to do about it.

**What we need decided:** whether 37.6's flow is Stage 2 (almost certainly),
and if so a line in D.9 saying so. The reason it matters is that a frontend
session reading 37.6 will build the buttons, and a control that cannot work
is worse than none on a screen already telling the user something is wrong.

**Frontend state:** `VariantTabs` shows the badge and an explanation, and
deliberately renders no regenerate control. Editing the wording by hand is
offered instead, since that is the one thing that does work. Revisit when the
job exists.

---

## B. Schema completeness

Six places where the published schema says less than the API actually
promises. All six are annotations rather than behaviour changes.

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

### B.4 — ten operations declare no success response

Not a missing field: a missing `200`. These declare only `404`, `412` and
`428`, so a generated client has no response type for any of them.

| Operation                      | Really answers           |
| ------------------------------ | ------------------------ |
| `GET /profile/sections`        | `200` `Section[]`        |
| `GET /profile/entries`         | `200` `Entry[]`          |
| `GET /profile/atoms`           | `200` `Atom[]`           |
| `PATCH /profile/sections/{id}` | `200` `Section` + `ETag` |
| `PATCH /profile/entries/{id}`  | `200` `Entry` + `ETag`   |
| `PATCH /profile/atoms/{id}`    | `200` `Atom` + `ETag`    |
| `PATCH …/variants/{variantId}` | `200` `Variant` + `ETag` |
| the three `POST …/reorder`     | `200`                    |

Between them that is every collection read and every partial write — the two
things the profile editor does constantly. `@ApiResponse` on each would close
it.

**Frontend state:** `src/lib/api/endpoints/profile.ts` states the response
types from `components['schemas']` and says why in its header. The item
schemas are complete, so the shapes are still generated; only the wrapper is
asserted, and it is checked against the running server.

### B.5 — `EntryPatch` cannot express the clear it documents

`organization` and `endDate` carry "Send null to clear" / "Send null when the
job becomes ongoing again" in their descriptions, and are typed plain
`string`. So the generated `EntryPatch` rejects the exact body D.9 · 16 is
about — the one that removes an end date to mean "current".

**Proposed:** mark both nullable. In OpenAPI 3.1 that is
`"type": ["string", "null"]`.

**Frontend state:** widened locally in `endpoints/profile.ts`, marked as
temporary.

### B.6 — `/profile/export` has a second, undeclared response type

`?format=json` answers `application/json` with `ProfileExport`.
`?format=markdown` answers `text/markdown`, and the schema declares only the
first. A client that trusts it parses markdown as JSON and throws on the
first character.

**Proposed:** declare both media types on the 200.

**Frontend state:** split into `exportProfileAsJson` and
`exportProfileAsMarkdown`, the latter reading text.

### B.8 — `content` is required on the variant PATCH, so promoting resends it

`PATCH /profile/atoms/{id}/variants/{variantId}` takes `VariantWrite`, where
`content` is required. Every other field merge-patches correctly — verified:
omitting `language` keeps it — but a write that is only about `primary` is
refused:

```
PATCH …/variants/{id}   {"primary": true}
→ 400 VALIDATION_FAILED, params.fields = ["content"]
```

So making a wording the default means resending its entire text, on a write
that is not a text edit at all. It works, and `If-Match` keeps it safe — a
stale copy is refused rather than overwriting a newer one — but the client
has to be holding the full content to perform an operation that has nothing
to do with content.

**Proposed:** make `content` optional on the PATCH body while keeping it
required on `POST …/variants`. The endpoint is already merge-patch in
everything else; this is the one field that is not.

**Frontend state:** `AtomEditor` resends the wording unchanged when
promoting, with the reason in a comment so nobody "simplifies" it later.

### B.7 — operation ids are positional

`list`, `list_1`, `list_2`, `create_2`, `reorder_1`. Generators name things
from these — ours produces `operations["list_2"]` for "read the atoms". Not
harmful, but `@Operation(operationId = …)` would make the generated surface
legible if anything ever binds to it.

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

### C.3 — a write that changes nothing does not bump the version

`PATCH` with values identical to the stored ones answers `200` with the
**same** version; a real change bumps it. Checked deliberately, twice in a
row, not inferred from a single call.

Good behaviour, and load-bearing for autosave: a debounce that fires after a
user typed and then undid their change does not invalidate the version every
other open editor is holding.

### C.4 — an atom will not let go of its last primary wording

`DELETE …/variants/{id}` on the primary answers `400 VALIDATION_FAILED` with
`params.fields = ["primary"]`, rather than deleting it and promoting
something else. Correct — an atom with no default wording has nothing to
render — and worth writing down, because the client has to promote another
wording first and there is no way to discover that except by trying.

### C.5 — promoting a wording demotes the previous one and re-sorts

`PATCH …/variants/{id}` with `primary: true` demotes whichever wording was
primary and returns the list primary-first on the next read. The response
carries only the wording that was written, so a client that merges it without
knowing this ends up with two wordings both claiming to be the default.

Verified, and `usePatchVariant` applies the demotion locally _and_
invalidates, so the server still has the last word.

**One note on the seed data**, not a request: no atom on the running server
has more than one variant, and every wording is `tr` while
`enabledLanguages` is `["en"]`. So the multi-variant path — tabs, promotion,
staleness — has no coverage on either side except our mocks. A seeded atom
with two wordings would make it real for both of us.
