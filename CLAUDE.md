# AtomCV Frontend — Working Context

## What This Project Is

AtomCV lets a user build a structured "Master Profile" once, then generate
job-specific, ATS-optimized resumes and cover letters in seconds.

This repository contains **only the frontend**. The backend lives in a
separate repository (`atomcv-backend`, Java + Spring Boot). All business
logic belongs there.

During local development the backend runs at `http://localhost:8080`.

## Architecture Documents

Full specifications live in `docs/` (Turkish). These are a **read-only copy**
synced from the backend repository — never edit them here. They are re-synced
as the backend is built, so a section can change under you; when they do,
read EK D.9 first.

| Task                         | Read section                                        |
| ---------------------------- | --------------------------------------------------- |
| Any task (first session)     | Bölüm 4 (design principles), Bölüm 9 (user journey) |
| Understanding the product    | Bölüm I-II, Bölüm IV (scenarios)                    |
| API integration              | Bölüm 35                                            |
| Frontend architecture        | Bölüm 36                                            |
| Profile editor behavior      | Bölüm 37                                            |
| i18n                         | Bölüm 38                                            |
| Accessibility                | Bölüm 39                                            |
| Error screens and edge cases | Bölüm 11                                            |
| Anonymous mode capabilities  | Bölüm 9 (Aşama 0), Bölüm 35.7                       |
| Performance budgets          | Bölüm 52.3                                          |
| Folder structure             | Bölüm XI-B.3                                        |

**EK D is where decisions taken during construction live** — deviations,
additions and corrections that the body of the document does not carry. It is
appended to as the backend is built, so read it before trusting a body
section:

| Appendix   | Covers                                                             |
| ---------- | ------------------------------------------------------------------ |
| EK D.2     | The run/mark content model and its invariants                      |
| EK D.6     | The API contract: enums, ETag scope, SSE, quota, CSRF, claim       |
| EK D.7     | **Progress record** — what the backend has shipped, step by step   |
| EK D.8.x   | Per-step backend build notes (Stage 1)                             |
| **EK D.9** | **Everything with a frontend consequence, collected in one table** |

**D.9 is the frontend's index into EK D.** New topics are inserted before it,
so it stays last. Check it whenever the docs are re-synced, and read D.7 to
see what the backend has actually shipped — the body sections describe the
design, not the state.

`BACKEND-CONTRACT-GAPS.md` and `docs/backend-contract-response.md` no longer
exist — the sixteen contract questions and their verdicts were folded into
EK D.6, which is now the single source. Do not recreate either file.

## Critical Architecture Rule

**No BFF. No business logic in `src/app/api/`.**

Next.js is a presentation layer only. If you think you need an API route,
ask first. The only acceptable use is a thin proxy, and even that should be
justified.

`src/app/api/` does not currently exist and should not be created. In
production, nginx routes `/api/*` to Spring on the same domain. In local
development the same-origin illusion is preserved by a **rewrite** in
`next.config.ts` (`/api/v1/*` → `http://localhost:8080/api/v1/*`), not by a
route handler. This keeps `SameSite=Strict` cookies working and avoids CORS.

**Client providers live in `[locale]/(app)/layout.tsx`, not the root layout.**
The landing and legal pages are static marketing surface that fetches nothing;
anything the app shell pulls in would otherwise be paid on first contact with
the product, which is where the anonymous funnel is thinnest (Bölüm 12).
Moving TanStack Query alone off the landing route saved 7 KB gzipped. Do not
hoist a provider to the root layout for convenience.

`NextIntlClientProvider` is one of them. It serialises the **entire** message
catalogue into the HTML, so at the root it shipped the full legal text to
every landing visitor. Server components read translations from the request
config without it. The cost of that placement: next-intl's `Link` and any
client component calling `useTranslations` only work under `(app)` — outside
it, use a plain anchor with an explicit `/${locale}` prefix.

## Tech Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)
- Tailwind CSS + shadcn/ui (Radix primitives — accessibility comes free)
- TanStack Query — **server state**
- Zustand — **transient UI state only** (open sections, selected atom)
- React Hook Form + Zod — forms
- next-intl — i18n with ICU MessageFormat
- dnd-kit — drag-and-drop with keyboard sensor
- MSW — mocking while backend endpoints are not ready

**Deviations from Bölüm 5.2, agreed 2026-08-13:**

- **Next.js 16, not 15.** 15.x moved to a backport branch; starting there
  would build in a migration debt on day one. `next-intl` already supports 16. Turbopack is the default bundler and we keep that default.
- **No `tailwind.config.ts`** (Bölüm XI-B.3 expects one). Tailwind v4 is
  CSS-first — theme tokens live in `src/app/globals.css` via `@theme`.
- **`next.config.ts`, not `next.config.mjs`** — typed config, generated by
  create-next-app.

**Next 16 has breaking changes relative to earlier versions.** Full docs ship
with the package at `node_modules/next/dist/docs/`. Read the relevant file
there before writing Next-specific code — do not rely on recalled API shapes.
`AGENTS.md` at the repo root says the same thing; it is regenerated by
`next dev`, so it is committed rather than deleted.

## Routing Rules That Fail Quietly

Both of these produce no error — just a worse app — so they are easy to miss
in review.

- **Every page and layout must call `setRequestLocale(locale)`.** Not only the
  parent layout: Next renders layouts and pages in parallel, so the parent's
  call is not guaranteed to have run first, and next-intl then marks the route
  dynamic. The legal pages shipped as server-rendered-on-demand until this was
  caught in build output. Guard the value with `hasLocale` first — `[locale]`
  is a catch-all, so an unknown segment must 404 rather than fall back to
  English.
- **`tsc` alone is not a typecheck.** `PageProps` and `LayoutProps` are
  generated into `.next/types`, so `npm run typecheck` runs `next typegen`
  first. A bare `tsc` on a clean checkout reports errors that do not exist and
  misses ones that do.

## The Content Model — Rules `richContent.ts` Must Enforce

Atom text is a list of runs, not a string (Bölüm 12.3, 14.1). Marks are
semantic (`technology`, `metric`, `emphasis`, `link`, `organization`), never
stylistic — a template decides what bold means, and the rewrite validator
reads `metric` runs directly to check numbers survived.

```json
{
  "v": 1,
  "runs": [
    { "t": "Engineered ", "m": [] },
    { "t": "ETL", "m": ["technology"] }
  ]
}
```

These come from EK D.2 and D.9. They are invariants, not preferences — the
backend rejects content that breaks the first two.

1. **`href` belongs to `link` runs and only to them.** Required when `link` is
   present, forbidden otherwise. An `href` that will never render must not be
   stored silently. Enforce it in `richContent.ts`, not at each call site.
2. **Unknown marks must survive a round trip.** The mark list is open. The
   backend reads, keeps and plain-renders a mark it does not recognise, and the
   editor has to do the same — forward compatibility only works if both ends
   honour it. Drop one and a newer version's markup disappears the moment the
   user edits that sentence, which is exactly the silent loss of work P8 exists
   to prevent.
3. **`v` is the server's.** Send `runs`; the server stamps the version. If one
   is sent it may not exceed the current version — the backend refuses to read
   a newer stamp rather than guess at a field it does not understand.
4. **`m` is always an array.** Even an unmarked run carries `"m": []`, so
   `undefined` checks are noise.
5. **`content_hash` is the hash of the plain text.** Re-marking a sentence
   does not change it, which is deliberate: measured render costs survive a
   formatting-only edit. Anything asking "did this change enough to re-measure"
   must read the hash, not the run structure.
6. **Vocabularies travel lowercase.** `kind`, `layout`, `source`, `created_by`
   and `tone` are `bullet_list`, `about_paragraph` and so on over the wire.
   Watch the Turkish locale trap when casing them — always `toLowerCase('en')`
   or a plain map, never a locale-sensitive transform.

## API Types Are Generated, Not Written

```bash
npm run gen:api      # requires backend running at localhost:8080
```

This regenerates `src/types/api.d.ts` from the backend's OpenAPI schema.
**The generated file is committed** so the frontend builds without the
backend running.

**Never hand-write types that mirror backend DTOs.** That is a
synchronization bug waiting to happen.

**It has been run.** `api.d.ts` is the real schema — 15 paths, 32 schemas,
Stage 1 only. Three things were checked before building on it, all present:
the 27-code `ErrorCode` enum, the 9-value `ResolutionAction` enum, and the
`ETag` response header.

Where the client needs a shape the generated one does not give, **derive,
never restate** — `Omit<…>` plus the narrowing, so the next `gen:api`
surfaces a wire change as a typecheck failure. `src/types/domain.ts` and
`richContent.ts` both do this. Two reasons it is always needed:

- **springdoc marks almost nothing required.** `ApiError.code` and `.status`
  are optional in the schema although EK D.9 · 12 guarantees both. `domain.ts`
  requires them so the error path has no undefined branch.
- **Closed enums must be re-opened.** A generated enum is a snapshot of the
  day `gen:api` last ran. `ResolutionAction` stays `| (string & {})`: an
  action the server adds later has to render as a button, not crash the panel.

**Where the schema and the docs disagree, the schema wins** (EK D.6's standing
caveat) — but write down which, because it is usually the schema that is
incomplete. Two live cases, both handled defensively in `richContent.ts`:
`Run.m` and `Content.v` are optional on the wire while D.9 · 4 says `m` is
always an array. The running server does send both; the parser supplies `[]`
for a missing `m` and does not invent a missing `v`.

## Local Development Against Mocks

The backend does not exist yet. MSW provides the API surface, with **one set
of handlers** shared by three environments: browser (dev), Vitest (unit),
Playwright (e2e). One source of truth, no dev/test drift.

- Enabled by `NEXT_PUBLIC_API_MOCKING=enabled` in `.env.local`. When the flag
  is off, MSW is never loaded and requests go to the real backend.
- **The gate in `MockProvider` also keys on `NODE_ENV`, and that half is not
  redundant.** `next build` reads `.env.local` too, so a developer with
  mocking enabled locally once shipped the MSW runtime to production. Keep
  both halves, and keep the `import()` inside the guarded branch — hoisting it
  to module scope makes it reachable in the module graph and the chunk ships
  again even though nothing calls it. Both mistakes have already been made
  here; `npm run build` then grepping the chunks for `setupWorker` is how they
  were caught.
- Handlers encode **behavior**, not just example payloads: SSE phase
  progression, `409` + `resolutions`, `412` conflict, `429` quota, anonymous
  vs. authenticated `capabilities`.

**Time-boxed exception:** mock handlers are typed by `src/mocks/contracts.ts`,
marked `SCAFFOLDING`. It is the only place where backend-shaped types may be
hand-written, and nothing outside `src/mocks/` may import it.

**XI-B.9.2 step 4 says to delete it once `gen:api` works. It does, and the
file has to stay** — the instruction assumed the schema would cover the
mocked surface, and it does not. The published schema is Stage 1: profile
CRUD plus the synchronous `/generations/general`. Every endpoint the mocks
cover — `/auth/session`, the asynchronous `/generations`, `/jobs/{id}` and its
stream — is Stage 2 or 3 with no generated counterpart. Deleting the file
would not remove a mirror; it would leave the mocks untyped.

So it empties **per type, as each endpoint is published**, not in one step.
Nothing in it may describe a Stage 1 endpoint. The error envelope has already
moved out: `FailedEvent` uses `ProblemDetail['code']` and `Resolution` from
`@/types/domain`, so a mock cannot emit a code the renderer would not know.

## Absolute Rules — Never Violate

1. **No business logic in `src/app/api/`.**
2. **Never hand-edit `src/types/api.d.ts`.** Regenerate it.
3. **Server data lives in TanStack Query, not Zustand.** Never copy server
   state into a client store — two sources of truth create drift.
4. **Heavy components are lazily loaded** via `next/dynamic` with
   `ssr: false`: `react-pdf`, diff viewer, rich text editor. Initial JS
   bundle must stay under 200 KB gzipped.
5. **Every interactive element must be keyboard accessible.** Drag-and-drop
   needs both a keyboard sensor and explicit "move up / move down" buttons.
6. **Progress and save status must be announced** via `aria-live` regions,
   not conveyed by color or icon alone.
7. **Error responses follow RFC 7807 with a `resolutions` array.** Render
   those resolutions as buttons — do not hardcode error UI per error type.
8. **The server sends translation keys, not translated text.** Resolve
   `errors.{code}` through next-intl. Ignore the server's `title` field for
   display; it is a developer-facing string.
9. **Never use `Intl`-less date/number formatting.** Dates inside a generated
   CV follow the _content_ language, not the UI language.
10. **Session cookie is HttpOnly** — the frontend never reads or writes auth
    tokens in JavaScript. All API calls use `credentials: 'include'`.

## Product Behaviors That Are Easy to Get Wrong

- **Manual control is optional, not required.** The default output must be
  usable without the user touching anything. Do not force a review step
  after generation.
- **The fit report shows countable facts, never a percentage.**
  "Required skills 4/4" — not "87% match". Percentages imply false precision.
  Profile _completeness_ is the opposite case: it is a percentage by design
  ("Profile: 28% complete"). Do not unify these two.
- **When the profile is too thin, the CV may be shorter than one page.**
  This is correct behavior. Never pad. Show an informational note — not a
  warning, and never a retry prompt.
- **Anonymous mode is fully functional**, only narrower in scope: English
  only, preset templates, no customization, no history. Quality is never
  reduced. Gate the UI from the server's `capabilities` object, never from
  hardcoded assumptions.
- **The one screen that cannot be skipped** is the post-extraction review
  screen. Automatic extraction is never 100% accurate; an error that slips
  through silently propagates into every future CV. Do not confuse it with
  the post-generation review, which _is_ skippable.
- **Edits on the result screen are not local UI state.** A bullet toggle or a
  natural-language edit posts to the server, which re-runs the pipeline from
  Phase C. Freed budget can pull _other_ atoms back in, so the whole result
  — preview, fit report, rejected list — must be refetched. Optimistic
  update belongs in the profile editor, not here.
- **The same error arrives over two transports.** Preflight failures come
  back as a synchronous 4xx body; in-flight failures arrive as the SSE
  `failed` event. Both carry `code` + `params` + `resolutions`. One shared
  renderer handles both — never two parallel `switch (code)` blocks.
- **The anonymous session expires two hours after the last activity, not two
  hours after it started.** The wording matters: the sliding TTL was chosen
  precisely so nobody gets cut off mid-review, and copy promising a flat two
  hours re-creates the anxiety the decision removed. Warn from a freshly read
  `anonymousExpiresAt`, never from a cached one.

## Development Commands

```bash
npm run dev          # localhost:3000
npm run build
npm run typecheck    # next typegen, then tsc
npm run lint         # eslint          (lint:fix to autofix)
npm run format       # prettier --write (format:check in CI)
npm test             # Vitest          (test:watch while working)
npm run test:e2e     # Playwright, on port 3100
npm run size         # build, then check the bundle budget
npm run size:check   # check only — reads an existing build, used by CI
npm run gen:api      # regenerate API types (backend must be running)
```

**npm 11 is required**, and pinned in CI and the Dockerfile. The lock file
records optional native packages the way npm 11 resolves them; npm 10 — which
`node:22` still bundles — reads the same file as incomplete and fails
`npm ci`. A local `npm ci` on Windows passes either way, so this only shows up
on Linux.

## Testing

`tests/unit` (Vitest, jsdom) and `tests/e2e` (Playwright, Chromium). Both run
against **the same MSW handlers** as the browser, through `tests/setup.ts` and
the dev server respectively — a behaviour asserted in one is the behaviour
seen in the others. Unhandled requests fail rather than warn: a request
escaping to the network in a test is a bug in the test.

- e2e runs against `next dev`, because MSW is disabled in production builds by
  design. Until the backend exists a production build has no API at all.
- `jest-axe` covers components; assert the behaviour too, not only the absence
  of violations. Axe cannot tell you a skip link left the tab order.
- Assert ordering rather than an exact count at an instant when testing a
  stream. The count races it.

## Code Style

- Code, comments, commit messages, identifiers: **English**
- Conversation with the developer: **Turkish**
- UI source strings: **English** in `src/messages/en.json`; Turkish is a
  translation in `src/messages/tr.json`
- Exception: where `docs/` specifies exact user-facing copy, the Turkish
  string is reproduced **verbatim** and the English source is authored to
  match it. The spec is the authority on tone, not the translation direction.
- Commit format: Conventional Commits
- Prefer server components where possible; `'use client'` only when needed

## Contract Decisions

**EK D.6 is the authority; this section is the working summary.** Read it
before starting anything API-shaped.

Its own standing caveat: **prose is not authoritative, the published OpenAPI
schema is.** Six of the sixteen items close themselves once springdoc lands
with the first endpoint and `npm run gen:api` can run — but only if the schema
carries the enums and headers, not just happy-path payloads.

### Decided — build against these now

- **`title` is developer-facing.** Confirmed. Rule 8 stands: log it, never
  render it.
- **ETag exists on six resources only:** `profiles`, `sections`, `entries`,
  `atoms`, `atom_variants`, `applications`. Format `ETag: "7"` on
  single-resource GETs, plus a `version` field on every item inside collection
  responses.
- **⚠️ `generations` has no `version` column and will not carry an ETag.**
  Do **not** build `If-Match` or 412 conflict handling into the result screen.
  If optimistic concurrency turns out to be needed there, raise it as a schema
  change request rather than working around it client-side.
- **No `GET /profile/atoms/{id}`.** Seed the per-atom cache from the collection
  response, which carries `version` per item. The editor must never issue N
  requests to learn N versions. A single-atom endpoint arrives only when
  something concrete needs it — Bölüm 37.5's staleness flow is the likely
  first caller.
- **Anonymous sessions use the same `sid` cookie.** Authentication stays
  purely a `capabilities` question on the client.
- **⚠️ The anonymous TTL slides — it refreshes on activity.** Two
  consequences, both easy to get wrong:
  1. Re-read `anonymousExpiresAt` from **every** response. Caching the first
     value and scheduling a warning against it fires a false alarm at someone
     who is actively working.
  2. The copy says "two hours after your last activity", never "two hours".
     That string is ours to get right; Bölüm 9's literal wording is the thing
     the sliding TTL was chosen to avoid.
- **Server rendering never calls the API.** The descriptive throw in
  `client.ts` is permanent behaviour, not a placeholder. Server components
  render shell and static content only.
- **Export selects format with `?format=json|markdown`,** matching download.
- **`/api/v1/warmup` is operational only** — not in the schema, not routed
  through nginx. If it ever shows up in generated types, something is wrong.
- **The frontend never invents resolutions.** The server owns the list. A
  plain dismiss control outside the resolution row is fine; a synthesised
  action inside it is not.

### Accepted, arriving with their stage

- **The error catalogue is complete and shipped** — 27 codes with typed
  `params`, published as an OpenAPI enum (EK D.7, D.9 · 10). `en.json` and
  `tr.json` can finally be written. Codes with no ICU message yet:
  `RESOURCE_NOT_FOUND`, `VERSION_CONFLICT`, `VALIDATION_FAILED`,
  `PRECONDITION_REQUIRED`, `INTERNAL_ERROR`.
- **`resolutions[].action` has nine values** (EK D.9 · 23), confirmed against
  the published enum. `src/types/domain.ts` no longer transcribes them — it
  derives from the generated type and re-opens the union, because an action
  the server adds later must render as a button rather than crash the panel.
- **The server sends only declared `params`.** An undeclared key is refused, so
  a missing field is fixed in the catalogue — never by hand-adding it to a
  body, because that value will never arrive (D.9 · 11).
- **`type` is a relative path** (`/errors/conflicting-preferences`), and every
  error carries a `code` — including `INTERNAL_ERROR` on a 500, so the client's
  error path always works. An unknown URL is `404 RESOURCE_NOT_FOUND`, not a
  500 (D.9 · 12).
- **Stage 1 — pagination.** `GET /profile/atoms` unpaginated. Cursor
  pagination (`{ items, nextCursor }`) for `/generations` and `/applications`
  when those land in Stage 2.
- **Stage 1 — download.** Bytes served directly with
  `Content-Disposition: attachment`, filename carrying company and position.
  After the 14-day retention: `410 Gone` + `GENERATION_ARTIFACT_EXPIRED` +
  a `retry` resolution. Expiry never costs the user their work because
  `selection_state` is a permanent snapshot — so the expiry screen should
  offer regeneration, not condolences.
- **Stage 2 — job contract.** `id` on every SSE event, `Last-Event-ID`
  honoured on reconnect, `GET /jobs/{id}` in the proposed shape with
  `generationId` on completion and `error` on failure. Polling that endpoint
  is the sanctioned fallback when a stream closes without a terminal event.
- **Stage 2 — idempotency.** Honoured on `/generations`,
  `/generations/{id}/edits`, `/generations/{id}/cover-letter/regenerate` and
  `/ingestion/cv`; keys retained 24 hours.
- **Stage 2 — quota.** `Retry-After` on 429 plus `resetsAt` in `params`, and
  the counters exposed in `capabilities` so the limit is visible before it is
  hit rather than discovered by failing.
- **Stage 3 — CSRF.** Spring Security double-submit: `XSRF-TOKEN` cookie,
  `X-XSRF-TOKEN` header, unsafe methods only, `403` + `CSRF_TOKEN_INVALID` on
  mismatch. The seam is already marked `TODO(csrf)` in `client.ts`.
- **Stage 3 — `POST /api/v1/profile/claim`.** `200`, `404
NO_ANONYMOUS_PROFILE`, `409 PROFILE_ALREADY_EXISTS`.
  **⚠️ The 409 offers replace or keep only — merge is never coming.** Atom-level
  deduplication is Stage 4 work, and the API will not name a resolution it
  cannot honour. Keep the union open, but do not write a merge branch.

### Still open — do not design around these yet

- **Daily counter rollover timezone.** `usage_counters.period` is a `DATE` and
  nothing defines the boundary. UTC or Europe/Istanbul? Blocks `resetsAt`, and
  it is user-visible — a UTC rollover lands at 03:00 for a Turkish user. The
  quota UI cannot state a reset time until this is answered.
- **Anonymous idempotency does not dedupe.** The V1 unique index is keyed on
  `(user_id, idempotency_key)` and `user_id` is NULL for anonymous requests,
  which Postgres treats as distinct — so the same key opens a second job. A
  migration is planned. Until it lands, **the client must guard anonymous
  double-submits itself** (disable the control while a request is in flight);
  the server will not.
- **Whether the anonymous flow uses the job queue at all** (EK D.1, D.6.5). It
  blocks the idempotency fix above, so the client-side guard is the standing
  answer rather than a stopgap with a known end date.
- **`Scope.EPHEMERAL` does not exist server-side yet** (EK D.4). It arrives
  with the anonymous flow in Stage 3, so nothing anonymous can be built end to
  end before then — the mocks are the only anonymous surface until it lands.

## Deferred by Decision

Things deliberately left undone, so they are not mistaken for oversights.

- **Dark mode is not wired up.** shadcn's init bound the dark variant to a
  `.dark` class and dropped the `prefers-color-scheme` media query that
  create-next-app had. Nothing adds that class, so the app is light-only. The
  spec never mentions theming. A theme toggle **is planned** as its own task —
  it needs a provider, persistence, and flash-before-hydration handling
  (`guides/preventing-flash-before-hydration.md` in the bundled Next docs).
  Until then, do not half-implement it by re-adding the media query: that
  would give users a theme they cannot change.

## How We Work Together

1. **Apply the documented decisions as written.** Raise disagreements or gaps
   _before_ implementing.
2. **Work in small steps** with approval between them.
3. **Ask when ambiguous** rather than assuming.
4. **Update this file** when we make decisions future sessions need.

## Current Stage

<!-- Update this section as work progresses -->

**Stage 0 is complete and merged to `main`** (PR #1, CI green).

**Stage 1 has started.** The backend's Stage 1 API is live locally, `gen:api`
has run against it, the error envelope derives from the generated types, and
`richContent.ts` exists with its invariants under test. Next is the profile
editor — see "Stage 1" below for what the running server settled and what is
left.

MSW still covers everything the schema does not, which is all of Stage 2 and 3. With the backend running, `NEXT_PUBLIC_API_MOCKING=disabled` sends Stage 1
calls through the dev proxy to the real thing.

Built: scaffold and tooling · `[locale]` routing with `proxy.ts` · shadcn on
Radix · next-intl with ICU · TanStack Query and Zustand · API client, error
envelope and dev proxy · MSW handlers · app shell and a11y baseline · landing
and legal pages · Vitest, Testing Library and `jest-axe` · Playwright · the
bundle budget · CI and secrets scanning · Dockerfile, README, MIT licence.

Standing facts a new session needs:

- **`[locale]/(app)/dev/mocks` is a development-only harness** and the only
  place the shell, the providers, the mock worker, the API client and an
  `EventSource` mount together. It calls `notFound()` in production — verified
  against a real image, not assumed. Keep it working: it is what makes the
  plumbing testable before product screens exist.
- **SSE over MSW's service worker is verified working** in a real browser,
  with frames arriving incrementally. Bölüm 36.4's `EventSource` stands and no
  `fetch` + `ReadableStream` fallback is needed.
- **`bundle-budget.json` enforces Bölüm 52.3**, checked by
  `scripts/check-bundle-size.mjs` — see "The bundle budget has two ceilings"
  below. Not size-limit: it measures files you can name, and Next emits
  content-hashed chunks that say nothing about which route pulls them.
- **Legal pages live under `[locale]`**, not beside it as XI-B.3 shows —
  outside the segment they cannot be translated. They are drafts that say so
  on the page; no legal prose was invented for the undecided parts, and the
  section naming which AI providers receive profile content is explicitly
  marked as needing to be filled in before real users arrive.
- **`deploy.yml` is not written.** There is no server to deploy to yet. It
  lands with the VPS.
- **CI actions are on `@v4`** and GitHub now forces them onto a newer Node
  runtime with a deprecation warning. Upgrading to `@v5` is its own task, not
  a drive-by edit.

## What Later Stages Need From The Frontend

Derived from EK D.6, EK D.9 and XI-B.9.2. Not a schedule — a list of what must
be true before each piece of work is correct.

### The bundle budget has two ceilings — this is settled

Bölüm 52.3 was split by route class after Stage 0 measured the problem: the
shared baseline alone is **168.1 KB gzipped** and the marketing routes add
**0.0 KB** of their own. The ~30 KB that used to be left under a single 200 KB
ceiling does not hold dnd-kit, React Hook Form and Zod, let alone our own
components.

| Ceiling                  | Value                    |
| ------------------------ | ------------------------ |
| Shared baseline          | 175 KB                   |
| Marketing routes (total) | 200 KB                   |
| App routes (total)       | 280 KB, own share 105 KB |

`bundle-budget.json` is the enforcing copy and classifies each route by path;
anything that matches no marketing pattern is budgeted as an app route, so a
new route starts strict rather than inheriting the loosest ceiling. **Do not
raise these without a decision** — the numbers are Bölüm 52.3's, and raising
one quietly is exactly the failure the three-number split was designed to
prevent.

### Stage 1 — profile CRUD against a real API

**The backend finished Stage 1 (EK D.7).** Profile, section, entry, atom and
variant CRUD all exist, springdoc publishes `/v3/api-docs`, and there is one
endpoint that returns a PDF. The frontend is the side that is behind.

**Done: `gen:api`, the error envelope, `richContent.ts`, and the API layer.**
`contracts.ts` was narrowed rather than deleted — see "Local Development
Against Mocks" for why the documented deletion could not happen.

The API layer is `src/lib/api/{etag,queryKeys}.ts`,
`src/lib/api/endpoints/profile.ts` and `src/hooks/useProfile.ts`. Three
things in it are load-bearing and easy to undo by accident.

**⚠️ PATCH goes out as `application/json`, not `application/merge-patch+json`.**
Bölüm 35.6 specifies the merge-patch type and the running backend answers
**500 `INTERNAL_ERROR`** to it; the schema declares `application/json` on
every PATCH. The semantics are unchanged — omitted keys stay, `null` clears —
only the media type. A test pins it, because "fixing" the client to match the
prose breaks every save in the editor. Raised in `DOC-SYNC-REQUEST.md`; do
not change it back without that being settled.

**⚠️ `If-Match` must be quoted, and only `toIfMatch` builds it.** `If-Match: 2`
against version 2 answers **412**, verified — Spring compares literally. That
is the same response a real conflict gives, so the mistake surfaces as a
"someone else edited this" dialog shown to a user editing alone. Versions
arrive in two shapes (bare `version` on collection items, quoted `ETag` on
the header) and both go through `toIfMatch`. The client also throws rather
than sending a write whose `version` key is present but undefined.

**The version comes from the cache, not from the caller.** `usePatchAtom` and
`usePatchVariant` take no `version`; they read it from the seeded entry when
the request is built. A version threaded through a component was read at some
render and is stale by the second save, and after a 412 it is stale by
definition — this way "keep mine" is refetch-then-send with nothing to
thread. It depends on one thing: **the optimistic update must leave `version`
alone.** A test pins that, because an optimistic write that bumped it would
make every save after the first conflict against nobody.

**Atoms are cached per item and written through, never invalidated.** There is
no `GET /profile/atoms/{id}`, so the collection response is the only source of
per-atom versions: `useAtoms` seeds `profileKeys.atom(id)` as it lands, and
mutations put the server's copy into both caches. Invalidating the collection
to learn one atom's new version is the 200-atom refetch the design exists to
avoid. `useAtom`'s `queryFn` deliberately throws — nothing can fetch a single
atom, so reaching it means seeding was skipped. Never invalidate a per-atom
key; invalidate the collection, whose refetch re-seeds them.

Also verified against the running backend rather than read off the schema:

- **A write answers with the new version.** `PATCH` returns both `ETag: "2"`
  and `version` in the body, so autosave never needs a read between saves.
  The schema declares the `ETag` header on `GET`/`PUT /profile` and
  `PUT /preferences` only — the header is real everywhere, just undeclared.
  It also survives the `next.config.ts` dev proxy, checked end to end.
- **A write that changes nothing does not bump the version.** Same version
  back, `200`. So a debounce firing after a typed-then-undone edit does not
  invalidate the version other editors hold.
- **The error paths are exactly as specified.** A stale `If-Match` gives
  `412 VERSION_CONFLICT` with a single `retry` resolution; a missing one gives
  `428 PRECONDITION_REQUIRED` with none. `type` is relative
  (`/errors/version-conflict`), and `params` is absent rather than `{}`.
- **Atom and variant versions move independently.** Patching an atom's
  controls bumps the atom and leaves its variants at their own version. The
  editor must hold both, not one per atom.
- **`?format=markdown` on export returns `text/markdown`,** not JSON, and the
  schema declares only the JSON half. Hence `api.getText` and two functions.

- **`src/lib/content/richContent.ts` before any editor component.** It owns the
  run/mark types and the invariants in "The Content Model" above, with tests
  for the two the backend enforces: `href` only on `link` runs, and an unknown
  mark surviving a parse-and-serialise round trip. Every editor path goes
  through it, so those cannot be re-litigated per component.

What the shipped API already settles (EK D.9 · 13-20):

- **`GET /profile` never 404s.** The profile is created server-side on first
  use, so a new user gets a real, empty profile with `completeness: 0`. There
  is no "you have no profile yet" state to build.
- **`If-Match` is required on writes.** Missing header is `428
PRECONDITION_REQUIRED`, stale one is `412 VERSION_CONFLICT` with a `retry`
  resolution. Collection responses carry `version` per item, so nothing needs
  a second read before editing.
- **`PUT /profile` replaces** — an omitted field is cleared, so the form must
  send every field. Preferences are a separate endpoint and take **`PUT`, not
  `PATCH`** (Bölüm 35.2's list is out of date; D.9 · 15 is right).
- **Entry `PATCH` distinguishes absent from `null`:** omit to keep, send
  `null` to clear. That is how an end date is removed to mean "current".
- **Atoms are created with content**; `PATCH /atoms/{id}` changes only the
  controls, and text is edited through the variant endpoint with the whole
  content sent. Variants come back primary-first.
- **Reordering takes the complete list.** A partial list is a 400, and
  `displayOrder` cannot be patched directly.
- `completeness` is recomputed on every read — do not calculate it client-side.
- `GET /profile/export` is live with `?format=json|markdown`.

**`useAutosave` is built** (`src/hooks/useAutosave.ts`), with the debounces
from Bölüm 37.1 — 1200ms text, 500ms slider, 0 for a toggle or a drop, keyed
by gesture rather than by field. Four things in it are load-bearing:

- **A pending edit survives unmount.** The cleanup flushes rather than
  cancels: a collapsing section must not be a way to lose a sentence finished
  900ms ago (P8).
- **An edit that arrives mid-flight is sent, not swallowed.** Reporting
  "saved" while a newer value sits in the browser is the moment a user stops
  worrying about work that is not stored.
- **A 412 is `conflict`, not `error`.** It offers "keep mine / take theirs"
  (Bölüm 37.4), never an automatic merge. That pair is the editor's own
  affordance for one status — it is _not_ a `resolutions` row, so rule 7 is
  not being bent.
- **`conflict` still counts as unsaved** for the `beforeunload` guard. It
  reads as handled because it has buttons; until one is pressed the work is
  exactly as unsaved as a failure.

`SaveStatus` (`src/components/editor/SaveStatus.tsx`) renders the dot plus its
own `role="status"` region — deliberately not the app-wide `Announcer`, which
is for pipeline progress and would be talked over by two hundred fields. The
region renders at every status including idle-and-empty, because assistive
technology has to be watching a node before its content changes.

**The error catalogue and `ErrorPanel` are built.** All 27 codes in both
languages plus the nine resolution labels, `UNEXPECTED_ERROR` (what
`toApiError` synthesises for an unreadable body) and `NETWORK_UNREACHABLE`
(ours — a request that never arrived has no server code). Four things to know
before touching any of it:

- **`{completeness, number, percent}` is wrong.** ICU's percent style
  multiplies by 100 and `completeness` already arrives as 28, so that renders
  "2,800%" — a plausible sentence with a wrong number, which nothing
  type-checks. The catalogue uses `::percent scale/0.01`.
- **Array params must go through `formatErrorParams`.** ICU has no list
  argument, and next-intl does not throw on a raw array — it returns the key,
  so the user reads `errors.INSUFFICIENT_PROFILE` on the screen meant to
  explain things. Five codes carry a `string[]`.
- **`PARAMS` in `tests/unit/i18n/errorCatalogue.test.ts` is exhaustive by
  typecheck.** A code added by `gen:api` fails compilation naming itself,
  rather than reaching a user as an untranslated key. Add the message and the
  sample params together.
- **`toErrorLike` recognises the SSE payload structurally.** A `failed` event
  is a plain object with no status and never passed through `fetch`, so
  keying on `ApiError` alone would call every in-flight failure unexpected.
  That is what makes one renderer serve both transports.

`ErrorPanel` renders `resolutions` and knows no codes at all. Its own retry
and dismiss sit **outside** that row — the rule is that the frontend never
invents a resolution, and a control the server did not offer must not look
like one it did. A resolution whose action has no label is dropped rather
than rendered unnamed.

Still to build here: the editor components themselves, and the mandatory
post-extraction review screen (Bölüm 31.6) once ingestion exists.

The mutation surface is partial by intent: `usePatchAtom` and `usePatchVariant`
exist because autosave needs them. Create, delete and reorder have endpoint
functions but no hooks — those land with the components that call them, so
each arrives with a caller that shows it works.

**Do not attach a permanent screen to `POST /generations/general`** (D.9 · 22).
It is synchronous, Stage-1-only, stores nothing, and is replaced by Bölüm
35.3's `202` + job flow in Stage 2. It is useful for proving the pipeline end
to end, not for building on.

**`PAGE_LIMIT_EXCEEDED` must not offer "retry"** (D.9 · 21). The server already
tried shrinking the content twice before returning it, so retrying unchanged
is guaranteed to fail again. Offer raising the page limit or removing content.

### Stage 2 — generation flow

- `useJobStream` with `Last-Event-ID` resumption and a `GET /jobs/{id}`
  reconciliation on any disconnect. A spinner that can outlive its job is a
  P4 violation, not a cosmetic issue.
- Progress announced through the existing `Announcer`, not by the bar alone.
- Result screen: **no `If-Match`, no 412 handling** — generations carry no
  version. Toggles and natural-language edits post to the server and the whole
  result is refetched.
- Fit report renders counts, never a percentage; `MatchLevel` is a label, not
  a score.
- Guard anonymous double-submits client-side until the backend's idempotency
  index is fixed for NULL `user_id`.
- Quota UI can show counters from `capabilities` immediately, but cannot state
  a reset time until the rollover timezone is decided.

### Stage 3 — accounts and anonymous conversion

- Add the CSRF header at the marked seam in `client.ts`.
- Anonymous expiry warning driven by a freshly read `anonymousExpiresAt`,
  with copy that says "after your last activity".
- `POST /profile/claim` on sign-up when an ephemeral profile exists.
  Handle 200, 404 and 409 — **replace and keep only**.
- Magic-link verify page must POST, never GET (Bölüm 40.3): corporate mail
  scanners click links automatically and would burn the token.

### Stage 4 and beyond

- Theme toggle (see Deferred by Decision).
- Revisit `next/root-params` in `src/lib/i18n/request.ts` once it is supported
  in Route Handlers; `requestLocale` is deprecated but currently the only
  option that covers every case.
- Translate `docs/` to English before the repository goes public (XI-B.0).
