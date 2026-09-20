# Security

## Reporting a vulnerability

Open a **private** security advisory through GitHub's _Security_ tab on this
repository, or email `tetikmustafa03@gmail.com`. Please do not open a public
issue for anything exploitable.

This is one person's project. Expect an acknowledgement within a week, and a
fix on a timeline that depends on severity rather than on a promise made in
advance.

## What is deployed

**Nothing, yet.** There is no server and no domain, so there is no production
instance to attack and nothing of anybody's is stored anywhere. That changes
the shape of a useful report: what is worth telling us about today is a flaw
in the code that _would_ matter once it runs, rather than something observed
in the wild.

## This repository is the frontend only

Business logic, authentication, rate limiting and every call to a language
model live in `atomcv-backend`. Next.js here is a presentation layer with no
API routes of its own — `src/app/api/` does not exist, by rule — so a report
about scoring, quotas, session issuance or prompt handling belongs there.

What is in scope here:

- **Anything touching the session cookie.** It is `HttpOnly` and the frontend
  never reads or writes an auth token in JavaScript; a change that made it
  possible to would be a real finding.
- **Content rendered from user data.** Profile text is stored as runs with
  semantic marks and rendered through one component; an escape from that into
  markup is in scope.
- **Content rendered from the server's error envelope.** Errors carry a code
  and bounded `params`, and the client resolves the sentence — a path that
  puts server prose on screen unescaped is in scope.
- **The `next.config.ts` rewrite**, which preserves the same-origin illusion
  in development. It proxies to `localhost:8080` and must not become a way to
  reach anything else.
- **Dependencies.** `npm audit` is expected to be clean; a transitive advisory
  that reaches the browser bundle is worth reporting even if we have not
  triggered it.

What is not:

- Reports that require a deployment we do not have.
- Automated scanner output with no reproduction.
- Missing headers on a site that is not served yet — the content security
  policy lives in `docker/nginx/nginx.conf` in the backend repository and is
  verified on the first deployment.

## Data the client holds

Little, and none of it secret. `localStorage` is used for per-viewer
conveniences only — a remembered theme — and never for anything that must
persist reliably or be read back by the server. There is no analytics and no
third-party script beyond Cloudflare Turnstile, which is loaded only where a
site key is configured.

An anonymous session expires **two hours after the last activity**, sliding
rather than fixed, and its profile and generations go with it.
