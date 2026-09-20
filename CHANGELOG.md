# Changelog

What changed in the AtomCV frontend, for people who do not read the commit log.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html), and
nothing has been released yet — there is no deployment, so everything so far
sits under **Unreleased**. The first entry with a number will be the first one
somebody could have used.

**Entries are written per stage rather than per commit.** The commit log is
already per commit and is not the thing missing; what was missing is a reader
who wants to know what the product can do now and what it could not do a month
ago. The full build record lives in `docs/notes/archive/`.

**The in-app half of "release communication" is deliberately not built.** § 55
asks for both a changelog and a way to tell people inside the app what is new,
and no endpoint publishes a release — so a banner would have to be a constant
in the frontend, edited and deployed to say something the server does not know.
That is a second source of truth for a fact neither side owns. When a release
feed exists, the banner is a small screen on top of it.

## [Unreleased]

### Added

- Settings now hold what every generation starts from: the page limit, the
  language a CV comes out in, the language a cover letter comes out in, and the
  register it is written in — plus a free-text note that reaches the rewriting
  step. All five were on the wire with nothing to set them.
- The language a CV comes out in can also be chosen per generation, beside the
  other directives, because the posting you answer today need not be in the
  language you usually write in.
- **Export.** The whole profile as JSON or as Markdown, from the settings, for
  everybody including anonymous sessions — the portability the privacy policy
  and the terms both promise.
- The import screen shows the day's import allowance, so the limit is something
  you read rather than something that refuses you.

### Changed

- Preference writes now send only the part the screen owns; the whole body is
  assembled from the cache. Two screens writing preferences used to mean each
  had to remember to carry the other's fields through a `PUT` that replaces.
- The product name is one constant rather than five literals and three
  sentences, so renaming it is one edit (the name is temporary by design).

### Fixed

- `bundle-budget.json` no longer carries a byte-order mark.

## Earlier — before any release

Stages 0 through 3 and the bulk of stage 4, built between 2026-08-13 and
2026-09-21: the profile editor with autosave, optimistic updates and drag and
drop; CV import with its mandatory review; job-specific generation with a live
progress stream; the result screen with its coverage report, hand toggles and
natural-language edits; four download formats; history, application tracking,
account settings and deletion; anonymous use; three templates and saved
appearance sets; dark mode; SEO; and an accessibility sweep.

Per-stage detail is in `docs/notes/archive/stage-1.md` through `stage-4.md`.
