# Defect / Bug Tracking Report

| | |
|---|---|
| Document ID | NPRO-TST-DEF-001 |
| Version | 1.0 · 27 Nov 2026 |
| Period | Development (Steps 15 – 18c, product grid), 26–27 Nov 2026 |

Defects found during development verification; all fixed and verified. Earlier steps' fixes are recorded in commit history and
`HANDOFF.md`.

| ID | Summary | Severity | Found in | Cause | Fix | Status |
|---|---|---|---|---|---|---|
| D-01 | Attendance page kept reloading ("Syncing…" stuck) | High | Step 15 | Effect re-ran on config changes made by the load itself | Load keyed on a computed `sourceKey` | Closed |
| D-02 | Productivity bars invisible | Medium | Step 15 | Absolute container had no width, % children collapsed | `inset-0` container | Closed |
| D-03 | Search results drawn behind page cards and transparent | High | Step 16 | Stacking context and nested backdrop blur | `z-20` on the search, solid panel | Closed |
| D-04 | `/api/issues` 500 in tests | Medium | 18a | SQLite can't ORDER BY DateTimeOffset | Sort after loading | Closed |
| D-05 | API wouldn't start: invalid `appsettings.Development.json` | High | 18a | Unescaped backslash in connection string | Fixed JSON | Closed |
| D-06 | Saving refused on SQL Server (transactions + retry strategy) | High | 18b | User transaction not wrapped in the execution strategy | `CreateExecutionStrategy().ExecuteAsync` | Closed |
| D-07 | Mixed date formats could mis-sort lists | Medium | 18c | Server wrote `+05:30` offsets, browser `Z` | `UtcDateConverter` | Closed |
| D-08 | WCAG contrast failures on all screens | High | A11y audit | Muted text, brand blue, data colours too light | Tokens + `readable` pipe | Closed |
| D-09 | Mobile "close menu" button visible on desktop | Medium | A11y audit | Target-size CSS rule overrode `lg:hidden` | Rule skips classes containing "hidden" | Closed |
| D-10 | Icon + text buttons (e.g. "Create product") stacked vertically | Medium | Product grid | Same rule matched buttons with text (CSS can't see text nodes) | Rule limited to `[aria-label]` icon-only controls | Closed |
| D-11 | Product card ticket link name missing its visible text (WCAG 2.5.3) | Low | Product grid | Custom `aria-label` | Visible text + screen-reader suffix | Closed |

## Summary
| Severity | Found | Fixed | Open |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 5 | 5 | 0 |
| Medium | 5 | 5 | 0 |
| Low | 1 | 1 | 0 |

Lesson learned (see RCA NPRO-RCA-001): global CSS rules need a visual regression check; D-09 and D-10 came from one rule.
