# AtomCV — Frontend

AtomCV lets you build a structured profile once, then generate a resume
tailored to each job posting — inside a page limit that is calculated rather
than hoped for.

The idea underneath it: your professional history is a structured dataset, not
a document. A resume is one view of that data, produced under constraints.
Once the two are separated, the same profile can produce output for different
postings, formats, languages and page limits without anyone editing a file by
hand.

This repository holds **only the frontend**. The backend lives separately
(`atomcv-backend`, Java + Spring Boot) and owns all business logic — scoring,
selection, rendering and every call to a language model. Next.js here is a
presentation layer with no API routes of its own.

Free and open source under the MIT licence. There is no revenue model, no
service level agreement, and it is run by one person.

## Status

**Stage 0 — skeleton.** The backend exposes only a health endpoint so far, so
everything runs against [MSW](https://mswjs.io) mocks. What exists today:
locale routing, the marketing and legal pages, the API client and its error
handling, the app shell and accessibility baseline, and the test and CI
pipeline. The product screens arrive in Stage 1.

## Running it

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

`.env.local` ships with `NEXT_PUBLIC_API_MOCKING=enabled`, so the app answers
its own API calls through a service worker. Turn it off to talk to a real
backend on `localhost:8080`; requests go through a rewrite in
`next.config.ts`, which keeps the browser on one origin exactly as nginx does
in production.

There is a development harness at `/en/dev/mocks` that exercises the session
endpoint and a streaming job. It returns 404 in production builds.

**npm 11 is required.** The lock file records optional native packages the way
npm 11 resolves them, and npm 10 reads the same file as incomplete. CI and the
Docker image pin the same version.

## Commands

| Command             | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Development server                               |
| `npm run build`     | Production build                                 |
| `npm run typecheck` | Route type generation, then `tsc`                |
| `npm run lint`      | ESLint                                           |
| `npm run format`    | Prettier, writing in place                       |
| `npm test`          | Vitest — unit and component tests                |
| `npm run test:e2e`  | Playwright                                       |
| `npm run size`      | Build, then check the per-route bundle budget    |
| `npm run gen:api`   | Regenerate API types (needs the backend running) |

## How it is put together

```
src/
├── app/[locale]/          all routes; the root layout lives here
│   ├── page.tsx           landing (static)
│   ├── legal/             privacy and terms (static)
│   └── (app)/             the application shell and its providers
├── components/            ui (shadcn), layout, providers
├── lib/
│   ├── api/               fetch client, RFC 7807 errors, query client
│   └── i18n/              routing, request config, locale-aware navigation
├── mocks/                 MSW handlers shared by dev, Vitest and Playwright
├── messages/              en.json is the source; tr.json is a translation
└── stores/                Zustand — transient UI state only
```

Two rules shape most of this:

**Server data lives in TanStack Query, never in a client store.** Two copies
of the same thing drift.

**Client providers stay inside `(app)`.** The landing and legal pages fetch
nothing, and anything the app shell pulls in would otherwise be paid on first
contact with the product. They currently ship no client JavaScript at all.

## Testing

Unit tests, component tests and end-to-end tests all run against the same MSW
handlers, so a behaviour verified in one is the behaviour seen in the others.
Handlers encode behaviour rather than sample payloads — a preflight failure
carries the resolutions that become buttons, and a job streams its phases one
at a time.

## Documentation

`docs/` holds the full product and architecture specification (Turkish). It is
a read-only copy synced from the backend repository.

Its appendix EK D records decisions taken while building, and **EK D.9
collects everything with a frontend consequence** — the content model
invariants, the API contract verdicts, and what is still open.

`CLAUDE.md` is the working context: the decisions taken, the ones deliberately
deferred, and what each later stage needs.

## Licence

MIT — see [LICENSE](LICENSE).
