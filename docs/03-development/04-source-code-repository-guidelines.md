# Source Code Repository Guidelines

| | |
|---|---|
| Document ID | NPRO-REPO-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Repository | https://github.com/mmpandibe/produtctracking (default branch `main`) |

## 1. Layout

| Path | Contents |
|---|---|
| `src/` | Angular app (`app/core`, `app/layout`, `app/pages`, `app/shared`, `styles.css`) |
| `public/` | Static assets copied to the build (favicon) |
| `server/` | .NET solution: `src/Npro.Domain`, `src/Npro.Infrastructure` (+ `Migrations`), `src/Npro.Api`, `tests/Npro.Tests`, `global.json`, `dotnet-tools.json` |
| `scripts/` | Tooling (`a11y-scan.cjs`) |
| `docs/` | This documentation set |
| Root | `angular.json`, `package.json`, `proxy.conf.json`, `ROADMAP.md`, `HANDOFF.md`, `ACCESSIBILITY.md`, `README.md` |

## 2. Branching
- `main` is always releasable (build and tests green).
- Feature work: `feature/<short-name>`; fixes: `fix/<short-name>`; merge to `main` by pull request with review once more than one
  developer works on the code. Until then, small commits directly on `main` after tests pass.
- Release tags: `vMAJOR.MINOR.PATCH` (e.g. `v1.0.0` at go-live).

## 3. Commits
- Subject: imperative, ≤ 72 characters (`Products: compact cards, more per row`).
- Body: what changed and why, bullet list for multi-part changes.
- One logical change per commit; never mix formatting-only changes with logic.
- AI-assisted commits carry a `Co-Authored-By` trailer.

## 4. What never goes into the repository
Secrets and production configuration, `.env` files, certificates (`*.pfx`), `node_modules`, `dist`, `bin`, `obj`, `.angular/cache`,
`.claude/settings.local.json`, database files, personal data. (`.gitignore` files at the root and in `server/` enforce this.)
The development demo password in `appsettings.Development.json` is the only credential-like value; it is a local test value.

## 5. Pull requests (when used)
Description with purpose, screenshots for UI changes, test evidence (`ng test`, `dotnet test`, a11y scan), linked ticket; at least
one approval; Code Review Checklist completed.

## 6. Line endings
Repository stores LF (Git may convert on Windows checkouts); `.editorconfig` defines indentation.
