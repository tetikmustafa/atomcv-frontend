# Contributing

Thank you for looking. This is one person's project, run in the open, with no
revenue model and no service level agreement — so the most useful thing you
can send is usually a small, specific change with a reason attached.

## Getting it running

```bash
npm install          # npm 11; npm 10 reads this lock file as incomplete
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

`.env.local` ships with `NEXT_PUBLIC_API_MOCKING=enabled`, so the app answers
its own API calls through a service worker and you need nothing else running.
Turn the flag off to talk to a real backend on `localhost:8080`.

Before pushing:

```bash
npm run typecheck    # route type generation, then tsc
npm run lint
npm run format
npm test             # Vitest
npm run test:e2e     # Playwright, on port 3100
npm run size         # build, then the per-route bundle budget
```

`npm run typecheck` rather than a bare `tsc`: `PageProps` and `LayoutProps`
are generated into `.next/types`, so `tsc` alone reports errors that do not
exist and misses ones that do.

## What the review looks for

Mostly one thing: **does the code say why**. A comment that repeats the line
below it is noise; a comment that records what was measured, what was refused
and what would have been wrong is the thing that survives. Several files here
carry a paragraph explaining a two-line decision, and that is deliberate.

Beyond that:

- **A test should be able to fail.** When you fix something, break the fix and
  watch the test go red before you send it. There are recorded cases here of a
  test that passed for a year while asserting the absence of a control under a
  name it never had.
- **Match the surrounding code** rather than your own habits — comment
  density, naming, the shape of a hook.
- **Say what you did not do.** A deliberate gap with its reason is worth more
  than a half-built control.

## The rules that are not negotiable

These are in `CLAUDE.md` in full. The short version:

1. **No business logic in `src/app/api/`.** Next.js here is a presentation
   layer. The directory does not exist and should not be created; in
   development a rewrite in `next.config.ts` preserves the same-origin
   illusion, and in production nginx does.
2. **Never hand-edit `src/types/api.d.ts`.** It is generated from the
   backend's OpenAPI schema by `npm run gen:api` and committed so the app
   builds without the backend. Where the client needs a different shape,
   derive it — `Omit<…>` plus the narrowing — so the next generation surfaces
   a wire change as a typecheck failure.
3. **Server data lives in TanStack Query, not Zustand.** Two copies of one
   thing drift. Zustand holds transient UI state only.
4. **Heavy components are lazily loaded** through `next/dynamic` with
   `ssr: false`, and the per-route ceilings in `bundle-budget.json` are not
   raised without a decision written down.
5. **Every interactive element is keyboard accessible**, and drag-and-drop
   ships both a keyboard sensor and explicit move buttons.
6. **State is announced, not coloured.** Progress and save status go through
   an `aria-live` region; a colour or an icon alone is not enough.
7. **Errors render the server's `resolutions` as buttons.** No `switch (code)`
   per screen, and never an action the server did not send.
8. **The server sends translation keys, not sentences.** Resolve
   `errors.{code}` through next-intl; the `title` field is developer-facing.
9. **No `Intl`-less date or number formatting**, and dates inside a generated
   CV follow the _content_ language rather than the interface one.
10. **The session cookie is HttpOnly.** Nothing here reads or writes an auth
    token, and every call sends `credentials: 'include'`.
11. **Never case a wire vocabulary with a locale-sensitive transform.** Use an
    explicit `en` locale or a plain map — under Turkish, `I` lowercases to a
    dotless `ı` and a skill name stops matching itself.
12. **A colour pair is proved by arithmetic.** The palette is `oklch` and
    Tailwind's alpha modifiers compile to `oklab(… / α)`, which axe's contrast
    rule _drops_ rather than flags — so a pair at 3.16:1 passes the sweep.
    `tests/unit/lib/palette.test.ts` measures the pairs; add yours there.

## Copy

UI strings are written in `src/messages/en.json`; `tr.json` is a translation
of it, and the two are kept key-for-key identical. Both files are ICU
MessageFormat — Turkish has no plural and English does, so string
concatenation is not an option.

One exception runs the other way: where the specification fixes exact
user-facing wording, the Turkish string is reproduced verbatim and the English
is written to match it.

## Commits

Conventional Commits, and the body is where the reasoning goes. A message that
says what changed is the diff again; one that says what was wrong and what was
considered instead is the part nobody can reconstruct later.

## What is out of scope

- **Translating `docs/spec/**` into English.** Decided against: it is ~9,400
  lines, it would need keeping in step in two languages, and the code a
  contributor reads is already English.
- **A third interface language.** The cost is not the 600 keys — it is that
  every ICU branch has to be checked by hand, and a language with no users is
  a tax on every message written afterwards.
- **A blog.** `/how-it-works` is the one page that earned its place.
