# Software Development Standards

| | |
|---|---|
| Document ID | NPRO-SDS-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

These standards apply to all nPro code (frontend, backend, scripts) and documentation.

## 1. Architecture rules
- The **server is authoritative**: anything a user could abuse (access, numbering, automation) is enforced server-side; the UI
  may also check for a better experience.
- Keep the **frontend model and the server entities identical** (field names, string values). A model change updates
  `src/app/core/models.ts`, `server/src/Npro.Domain/Entities.cs`, the EF configuration and a migration together.
- Business logic lives in the store / domain, not in templates.
- New screens use shared components (`app-modal`, `app-page-header`, `app-move-menu`) and the classes in `src/styles.css`.

## 2. UI standards
- Compact light glass style, small fonts, dense rows; **no scroll areas inside the page**.
- Accessibility (WCAG 2.2 AA, mandatory): secondary text ≥ `text-ink/70`; brand `#0b5fd9`; data colours through `| readable`;
  no opacity fading of content (use `.muted-row`); icon-only buttons need `aria-label`; targets ≥ 24 × 24 px (use px — root
  font is 14 px); every drag action has a click / key alternative; dialogs via `app-modal` with the first field `autofocus`.
- Tables on md+, cards on phones; truncate long text with a tooltip.

## 3. Security standards
- Never put secrets in source control (production values come from the environment).
- Every new API write path must authorise per record and be covered by a refusal test.
- No raw SQL; EF Core only. No `innerHTML` with user content.
- Problem details must not leak stack traces or internal names.

## 4. Testing standards
- Each store method / domain rule has a unit test; each API rule has an integration test (WebApplicationFactory + SQLite).
- Fix a bug with a failing test first where practical.
- Accessibility scan must stay at 0 violations.

## 5. Documentation standards
- Public functions and non-obvious code have a one-line doc comment explaining *why*.
- Update `HANDOFF.md` (working context), `ROADMAP.md` (status), `server/README.md` (API / config) and this documentation set.

## 6. Versioning and commits
- Semantic, descriptive commit messages (subject ≤ 72 chars, body with what and why).
- Commit only when asked by the product owner; never commit secrets; push to `main` after tests pass.

See also: Coding Standards (NPRO-CS-001), Source Code Repository Guidelines (NPRO-REPO-001), Code Review Checklist (NPRO-CRC-001).
