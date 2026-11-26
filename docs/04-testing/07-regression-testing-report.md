# Regression Testing Report

| | |
|---|---|
| Document ID | NPRO-TST-REG-001 |
| Version | 1.0 · 27 Nov 2026 |

## 1. Regression approach
After every step the complete automated suites run (not only new tests); from 26 Nov the accessibility scan runs as well.

## 2. History (development)

| Change | Angular tests | Server tests | a11y scan | Result |
|---|---|---|---|---|
| Step 14 Gantt | 64 / 64 | — | — | Pass |
| Step 15 Attendance & productivity | 68 / 68 | — | — | Pass |
| Step 16 Dashboards & search | 70 / 70 | — | — | Pass |
| Step 17 Automation | 74 / 74 | — | — | Pass |
| 18a Backend foundation | 74 / 74 | 9 / 9 | — | Pass |
| 18b Sync, login, XSRF | 75 / 75 | 15 / 15 | — | Pass |
| Login redesign, employee ID | 76 / 76 | 15 / 15 | — | Pass |
| WCAG 2.2 AA pass | 77 / 77 | 15 / 15 | 0 violations (desktop + 320 px) | Pass |
| 18c Server rules | 79 / 79 | 20 / 20 | 0 | Pass |
| Product grid (commit 1cd0b22) | 79 / 79 | 20 / 20 | 0 (after fixing D-10, D-11) | Pass |

## 3. Regressions found
- D-09 / D-10: a global accessibility CSS rule changed the layout of buttons elsewhere; caught by visual checks, not by the automated
  suites. Action: add visual regression snapshots (Playwright) for key screens.

## 4. Smoke checklist (run before every release)
Sign in (email and employee ID) · dashboard loads · create ticket (server number) · comment · move on board · log time · open Gantt ·
support queue · CXO summary · sign out · offline demo opens without API.
