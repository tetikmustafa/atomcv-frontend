# AtomCV Frontend — Working Context

## What This Project Is

AtomCV lets a user build a structured "Master Profile" once, then generate
job-specific, ATS-optimized resumes and cover letters in seconds.

This repository contains **only the frontend**. The backend lives in a
separate repository (`atomcv-backend`, Java + Spring Boot). All business
logic belongs there. In local development it runs at `localhost:8080`.

### Documentation Access — Manual Only

Do NOT read anything under `docs/` — `INDEX.md`, `STATUS.md`, `spec/**`,
`notes/**`, `handoff/**` — at the start of a session, at the start of a task,
or proactively while working, **unless the user's current message explicitly
asks you to.**

Explicit means one of:

- "check the spec for X" / "read INDEX.md" / "what's in STATUS.md"
- "check if there's anything from backend/frontend" (→ read the handoff file only)
- "update the notes" / "record this as a deviation"
- the user names a section by number ("per Bölüm 20")

If you think consulting a doc would help and the user hasn't asked for it,
**ask in one sentence instead of reading it**: "İlgili kararı `spec/05-...`'de
kontrol edeyim mi?" Wait for yes.

If you're missing a fact you'd normally get from a doc, ask the user for the
fact directly. Do not read a 300-line file to answer a one-line question.

**Never write to `docs/notes/**` or `docs/STATUS.md` unless the user
explicitly asks you to record something.** Silently updating these after
finishing a task is exactly the behavior being removed here.

## Propose, Don't Run

For the operations below, **never call Bash yourself.** Print the exact
command(s) in a fenced code block, say one line about what it does, and stop.
I will run it myself.

- `git push`, `git merge`, `git rebase`, anything touching a remote or moving
  `main`
- `gh pr create`, `gh pr merge`, `gh pr review`
- `scripts/sync-spec.sh`, `scripts/sync-handoff.sh`, or any script under
  `scripts/` whose job is repo-to-repo sync
- Anything under `docker-compose.prod.yml` or touching the deploy pipeline
- Database migrations against anything other than the local dev database
- Any command that deletes data (`git clean -fdx`, `docker volume rm`, etc.)

This is enforced at the tool-permission layer too (see `.claude/settings.json`
and the PreToolUse hook) — if a call is blocked, don't retry it. Print the
command and move on.

You may run freely, without asking: local build, test, lint, typecheck, and
any `gradlew`/`npm` script that only touches this repo's own working tree.

### Read on demand — never in full

Once reading **has** been asked for: `docs/INDEX.md` routes it, then `rg` the
range. Most often `spec/09-frontend.md`, `08-api.md`, `08b-api-contract.md`,
`01-foundations.md`.

### ⚠️ `docs/spec/**` is a read-only copy

It is synced from `atomcv-backend`. **Editing it here is pointless** — the next sync
overwrites your change.

Need a spec change? Write an item in `docs/handoff/to-backend.md` instead.

### Ownership

| Path                            | Owner        | Synced                       |
| ------------------------------- | ------------ | ---------------------------- |
| `docs/spec/**`, `docs/INDEX.md` | backend repo | ← read-only copy             |
| `docs/STATUS.md`                | shared       | both ways                    |
| `docs/handoff/**`               | shared       | both ways — the real channel |
| `docs/notes/**`                 | this repo    | never synced                 |

## Recording Deviations, and Asking the Backend

Deviations go in `docs/notes/current.md`, same format as backend. A **spec**
change is not ours to make: ask for it in `docs/handoff/to-backend.md` as an
`F-nnn` item.

## Where the Standing Answers Live

These are specified, not summarised here — a second copy would drift.

| Question                                                  | File                           |
| --------------------------------------------------------- | ------------------------------ |
| The eight design principles every decision traces back to | `spec/01-foundations.md` § 4   |
| Why this technology and not that one                      | `spec/02-tech-stack.md`        |
| Run/mark model — `href`, unknown marks, `m`, `v`          | `spec/04-data-model.md` § 14.1 |
| `content_hash` is the hash of the plain text              | `spec/04-data-model.md` § 16.2 |
| Endpoints, ETag scope, PATCH semantics, `completeness`    | `spec/08-api.md` § 35.6        |
| Error catalogue, `params` discipline, closed vocabularies | `spec/08b-api-contract.md`     |
| Anonymous TTL slides — "two hours after last activity"    | `spec/08-api.md` § 35.7        |
| Frontend architecture, profile editor, i18n, a11y         | `spec/09-frontend.md` § 36-39  |
| Test strategy, the tests that matter most                 | `spec/12-quality.md` § 51      |
| Performance budgets                                       | `spec/12-quality.md` § 52      |
| Anything else                                             | `docs/INDEX.md` routes it      |

`src/lib/content/richContent.ts` owns the run/mark invariants in code, and
every editor path goes through it — they are not re-litigated per component.

Stack: Next.js 16 (App Router, Turbopack), React 19, TypeScript strict,
Tailwind v4 + shadcn/ui on Radix, TanStack Query (**server state**), Zustand
(**transient UI state only**), React Hook Form + Zod, next-intl with ICU,
dnd-kit, MSW. **Where we deviate from `spec/02-tech-stack.md` the reason is
recorded in `docs/notes/current.md` § D.10, not repeated here.**

**Next 16 has breaking changes relative to earlier versions.** Full docs ship
with the package at `node_modules/next/dist/docs/`. Read the relevant file
there before writing Next-specific code — do not rely on recalled API shapes.
`AGENTS.md` at the repo root says the same; it is regenerated by `next dev`,
so it is committed rather than deleted.

## Critical Architecture Rule

**No BFF. No business logic in `src/app/api/`.**

Next.js is a presentation layer only. If you think you need an API route,
ask first. The only acceptable use is a thin proxy, and even that should be
justified.

`src/app/api/` does not currently exist and should not be created. In
production, nginx routes `/api/*` to Spring on the same domain. In local
development the same-origin illusion is preserved by a **rewrite** in
`next.config.ts` (`/api/v1/*` to `http://localhost:8080/api/v1/*`), not by a
route handler. This keeps `SameSite=Strict` cookies working and avoids CORS.

**Client providers live in `[locale]/(app)/layout.tsx`, not the root
layout**, so the landing and legal pages pay for none of them — that layout's
own comment says what each one costs. The consequence to remember while
writing code: next-intl's `Link` and any client component calling
`useTranslations` only work under `(app)`; outside it, use a plain anchor with
an explicit locale prefix.

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

## API Types Are Generated, Not Written

```bash
npm run gen:api      # requires backend running at localhost:8080
```

This regenerates `src/types/api.d.ts` from the backend's OpenAPI schema.
**The generated file is committed** so the frontend builds without the
backend running.

**Never hand-write types that mirror backend DTOs.** That is a
synchronization bug waiting to happen. **Never hand-edit `api.d.ts`** —
regenerate it.

Where the client needs a shape the generated one does not give, **derive,
never restate** — `Omit<…>` plus the narrowing, so the next `gen:api` surfaces
a wire change as a typecheck failure. `src/types/domain.ts` does this and says
why: springdoc marks little as required, and a generated enum is a snapshot
rather than a promise.

**Where the schema and the docs disagree, the schema wins** — but record which
in `docs/notes/current.md`, because it is usually the schema that is
incomplete, and raise an `F-nnn` item if the spec text needs correcting.

## Local Development Against Mocks

MSW provides the API surface the backend has not published, with **one set of
handlers** shared by three environments: browser (dev), Vitest (unit),
Playwright (e2e). One source of truth, no dev/test drift.

- Enabled by `NEXT_PUBLIC_API_MOCKING=enabled` in `.env.local`. When the flag
  is off, MSW is never loaded and requests go to the real backend.
- **`MockProvider` guards on `NODE_ENV` as well as the flag, and keeps the
  `import()` inside the guarded branch.** Both mistakes shipped MSW to
  production once; the file says how each one did. `npm run build`, then grep
  the chunks for `setupWorker`.
- Handlers encode **behavior**, not example payloads — `handlers.ts` lists
  which behaviours and why.

**Time-boxed exception:** `src/mocks/contracts.ts` is the only place
backend-shaped types may be hand-written, and nothing outside `src/mocks/` may
import it. Its own header carries the rules for emptying it.

## Absolute Rules — Never Violate

1. **No business logic in `src/app/api/`.**
2. **Never hand-edit `src/types/api.d.ts`.** Regenerate it.
3. **Server data lives in TanStack Query, not Zustand.** Never copy server
   state into a client store — two sources of truth create drift.
4. **Heavy components are lazily loaded** via `next/dynamic` with
   `ssr: false`: `react-pdf`, diff viewer, rich text editor. Bundle ceilings
   live in `bundle-budget.json` and must not be raised without a decision.
5. **Every interactive element must be keyboard accessible.** Drag-and-drop
   needs both a keyboard sensor and explicit "move up / move down" buttons.
6. **Progress and save status must be announced** via `aria-live` regions,
   not conveyed by color or icon alone.
7. **Error responses follow RFC 7807 with a `resolutions` array.** Render
   those resolutions as buttons — do not hardcode error UI per error type,
   and never invent a resolution the server did not send.
8. **The server sends translation keys, not translated text.** Resolve
   `errors.{code}` through next-intl. Ignore the server's `title` field for
   display; it is a developer-facing string.
9. **Never use `Intl`-less date/number formatting.** Dates inside a generated
   CV follow the _content_ language, not the UI language.
10. **Session cookie is HttpOnly** — the frontend never reads or writes auth
    tokens in JavaScript. All API calls use `credentials: 'include'`.
11. **Never case a wire vocabulary with a locale-sensitive transform.** Use
    an explicit `en` locale or a plain map — the Turkish locale trap is real.
12. **A colour pair is proved by arithmetic, not by the axe sweep.** The
    palette is `oklch` and Tailwind's alpha modifiers compile to
    `oklab(… / α)`; axe's contrast rule **drops** such a node — not a
    violation, not even incomplete — so `bg-x/20` text can sit at 3.16:1 and
    pass. `tests/unit/lib/palette.test.ts` measures the pairs, hover included.
    Add the pair there when you paint a new one.

## Product Behaviors That Are Easy to Get Wrong

Specified in `spec/01-foundations.md` and `spec/09-frontend.md`; listed here
because each has already been got wrong somewhere.

- **Manual control is optional.** The default output must be usable without
  the user touching anything. Never force a review step after generation.
- **The fit report shows countable facts, never a percentage** ("Required
  skills 4/4"). **Completeness is the opposite** — a percentage by design.
  Do not unify them.
- **A thin profile may produce a CV shorter than one page.** That is correct.
  Never pad; show an informational note — not a warning, not a retry prompt.
- **Anonymous mode is fully functional**, only narrower: English only, preset
  templates, no history. Quality is never reduced. Gate the UI from the
  server's `capabilities`, never from hardcoded assumptions.
- **The post-extraction review screen cannot be skipped.** Extraction is never
  perfectly accurate and a silent error propagates into every future CV. The
  post-generation review _is_ skippable — do not confuse them.
- **Edits on the result screen are not local UI state.** They post to the
  server, which re-runs the pipeline from Phase C, so the whole result must be
  refetched. Optimistic update belongs in the profile editor, not here.
- **The same error arrives over two transports** — a synchronous 4xx body and
  the SSE `failed` event. One shared renderer handles both; never two parallel
  `switch (code)` blocks.
- **The anonymous session expires two hours after the last activity.** The
  sliding TTL was chosen so nobody is cut off mid-review; copy promising a
  flat two hours re-creates the anxiety it removed. Warn from a freshly read
  `anonymousExpiresAt`, never a cached one.

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
./scripts/check-doc-sizes.sh   # rolling docs still within their limits
```

**npm 11 is required**, and pinned in CI and the Dockerfile; npm 10 fails
`npm ci` on this lock file, and only on Linux. Both pins carry the reason.

## Testing

Strategy is `spec/12-quality.md` § 51. What is specific to this repo:

`tests/unit` (Vitest, jsdom) and `tests/e2e` (Playwright, Chromium) run
against **the same MSW handlers** as the browser, through `tests/setup.ts` and
the dev server respectively. Unhandled requests fail rather than warn: a
request escaping to the network in a test is a bug in the test.

- e2e runs against `next dev` on port 3100, because MSW is disabled in
  production builds by design.
- `jest-axe` covers components; assert the behaviour too, not only the absence
  of violations. Axe cannot tell you a skip link left the tab order.
- Assert ordering rather than an exact count at an instant when testing a
  stream. The count races it.
- Anything genuinely dependent on measured size belongs in the Playwright
  suite — jsdom has no layout, and `tests/setup.ts` says what it stubs.

## Code Style

- Code, comments, commit messages, identifiers: **English**
- Conversation with the developer: **Turkish**
- UI source strings: **English** in `src/messages/en.json`; Turkish is a
  translation in `src/messages/tr.json`
- Exception: where `spec/` specifies exact user-facing copy, the Turkish
  string is reproduced **verbatim** and the English source is authored to
  match it. The spec is the authority on tone, not the translation direction.
- Commit format: Conventional Commits
- Prefer server components where possible; `'use client'` only when needed

## Deferred by Decision

- **`deploy.yml` is not written.** There is no server to deploy to yet, and
  no domain either — which is why `NEXT_PUBLIC_SITE_URL` falls back to
  localhost. Canonical URLs, the hreflang map, `robots.txt` and
  `sitemap.xml` are all built from it, so the deploy has to set it.
- **CI actions are on `@v5`** (2026-09-12) and that bump is the one change
  here that cannot be verified locally — these jobs only run on push. `@v4`
  is the revert.

## How We Work Together

1. **Apply the documented decisions as written.** Raise disagreements or gaps
   _before_ implementing.
2. **Work in small steps** with approval between them.
3. **Ask when ambiguous** rather than assuming.
4. **Update this file** when we make decisions future sessions need — but
   prefer `docs/notes/current.md` for anything stage-shaped.

## Current Stage — and How to Resume

**Stage 4 — maturation, and it is continuous.** Stages 0-3 are closed; their
full build records are `docs/notes/archive/stage-1.md`, `stage-2.md` and
`stage-3.md`. There is no fixed order here: § XI-A.7 hands the priority to
feedback and to the developer, so the step to work on is a decision, not a
lookup.

A session that opens with "continue" starts here, in this order.
Nothing below is summarised in this file: a second copy of the state drifts
from the one that is real.

1. **`docs/STATUS.md`** — which step each repo is on, the open cross-repo
   decisions, and the next sync point.
2. **`docs/handoff/to-frontend.md`** — open `B-nnn` items from the backend.
   **Handle these before starting new work.**
3. **`docs/notes/current.md`** — the invariants that span files, the
   deliberate gaps that must not be "fixed" without asking, and what earlier
   stages handed forward. Short by design; the archive holds the rest.
4. **The step's plan** — `docs/INDEX.md` routes it. The frontend build order
   is `spec/15-repos-and-claude.md` § XI-B.9.2; Stage 4 is
   `spec/14-build-guide.md` § XI-A.7, and § 55 is the list it points at.
   Search the file, read the range.

Close the step the way _Recording Deviations_ and _Cross-Repo Communication_
describe: a record in `docs/notes/current.md`, an `F-nnn` item if the backend
must act, `STATUS.md` marked — all in the same commit as the code.

**When a stage closes**, or when a rolling file outgrows its limit
(`./scripts/check-doc-sizes.sh` says when): `docs/notes/archive/README.md`.
