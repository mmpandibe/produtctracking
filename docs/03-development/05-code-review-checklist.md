# Code Review Checklist

| | |
|---|---|
| Document ID | NPRO-CRC-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

Tick every item, or note why it doesn't apply.

## Functionality
- [ ] Meets the user story's acceptance criteria; edge cases (empty, max length, no permission) handled
- [ ] Works in offline demo mode and in server mode
- [ ] Role / scope rules respected in the UI **and** enforced on the server for any new write path

## Security
- [ ] No secrets, tokens or personal data in code, logs or commits
- [ ] New `/api/sync` collection or field: authorisation added and a refusal test written
- [ ] Inputs validated; no raw SQL; no `innerHTML` with user content
- [ ] Error messages don't leak internals

## Data
- [ ] Model change applied to `models.ts`, `Entities.cs`, EF configuration and a migration
- [ ] State updates are immutable (sync diff relies on object identity)
- [ ] Timestamps stored / sent as UTC ISO

## Accessibility (WCAG 2.2 AA)
- [ ] Secondary text ≥ `text-ink/70`; data colours via `| readable`; no opacity on content
- [ ] Icon-only buttons have `aria-label`; targets ≥ 24 px
- [ ] Keyboard path works; drag actions have an alternative; dialogs use `app-modal`
- [ ] `npm.cmd run a11y` and `a11y:mobile`: 0 violations

## UI
- [ ] Checked at 1366 px and 375 / 320 px; no horizontal or inner scrolling
- [ ] Uses shared classes / components; compact spacing; consistent wording
- [ ] Global CSS change (`styles.css`, broad selectors): checked several screens at desktop, tablet and phone width (see RCA NPRO-RCA-001)

## Quality
- [ ] `ng build`, `ng test`, `dotnet test` pass; new logic has tests
- [ ] Code is readable, named clearly, commented where non-obvious; no dead code
- [ ] Performance: no N+1 queries, no heavy work in templates / computed loops

## Docs
- [ ] HANDOFF / ROADMAP / README / API spec updated where affected
