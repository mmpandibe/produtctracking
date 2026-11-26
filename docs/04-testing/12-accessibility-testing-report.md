# Accessibility Testing Report

| | |
|---|---|
| Document ID | NPRO-TST-A11Y-001 |
| Version | 1.0 · 27 Nov 2026 |
| Standard | WCAG 2.2 Level AA |
| Detailed record | `ACCESSIBILITY.md` (repo root) and WCAG Accessibility Compliance Report (NPRO-WCAG-001) |

## 1. Automated testing
Tool: axe-core 4.14 (rules tagged wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice) in headless Edge,
`scripts/a11y-scan.cjs`. States: 26 screens / tabs, 4 open dialogs, login page.

| Run | Before fixes (26 Nov) | After fixes (27 Nov, commit 1cd0b22) |
|---|---|---|
| Desktop 1366 px | 9 rule types failing (contrast on every screen, label-in-name, target size, ARIA roles, empty headers, landmarks) | **0 violations** |
| Phone 320 px | Additional reflow overflow on CXO summary; Gantt target size | **0 violations, no horizontal scroll** |

## 2. Manual testing (development)

| Check | WCAG | Result |
|---|---|---|
| Skip link is first Tab stop, moves focus to main | 2.4.1 | Pass |
| Visible focus on all controls | 2.4.7, 2.4.11 | Pass (visual spot checks) |
| Dialogs: focus in, trapped, Escape, return | 2.1.2, 2.4.3 | Pass |
| Board "Move" menu by keyboard (arrows, Escape) | 2.1.1, 2.5.7 | Pass |
| Workflow statuses reorder with arrow buttons | 2.5.7 | Pass |
| Tooltips dismissible with Escape | 1.4.13 | Pass |
| Reduced motion honoured | 2.3.3 (AAA, best practice) | Implemented |
| Screen reader walkthrough (NVDA + Edge, VoiceOver iOS) | 1.3.1, 4.1.2, 4.1.3 | **Not yet done** |
| 200 % zoom and text spacing | 1.4.4, 1.4.12 | **Not yet done** (reflow at 320 px passes) |

## 3. Conclusion
Automated conformance and keyboard behaviour meet WCAG 2.2 AA for all tested states. A formal conformance claim requires the
screen-reader pass and the zoom / text-spacing checks (owner: QA, Project Plan week 3).
