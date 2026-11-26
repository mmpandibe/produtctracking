# WCAG Accessibility Compliance Report

| | |
|---|---|
| Document ID | NPRO-WCAG-001 |
| Version | 1.0 · 27 Nov 2026 |
| Standard | WCAG 2.2 Level A and AA (55 success criteria; 4.1.1 Parsing obsolete in 2.2) |
| Evaluated | nPro web app, commit `1cd0b22`: 26 screens / tabs, 4 dialogs, login; desktop 1366 px and 320 px |
| Methods | axe-core 4.14 automated scan (0 violations), keyboard testing, code review. **Not yet**: screen-reader testing, zoom / text-spacing testing |

Status legend: **Supports** · **Partially supports** · **Not applicable** · **Not yet evaluated** (needs manual assistive-technology testing).

| Criterion | Level | Status | Notes |
|---|---|---|---|
| 1.1.1 Non-text content | A | Supports | Icon-only controls have labels; decorative icons hidden; avatars have names |
| 1.2.1–1.2.5 Time-based media | A/AA | Not applicable | No audio / video |
| 1.3.1 Info and relationships | A | Supports (automated) | Headings, tables with headers, labelled fields, landmarks; screen-reader check pending |
| 1.3.2 Meaningful sequence | A | Supports | DOM order matches visual order |
| 1.3.3 Sensory characteristics | A | Supports | Instructions don't rely on shape / position only |
| 1.3.4 Orientation | AA | Supports | Works in portrait and landscape |
| 1.3.5 Identify input purpose | AA | Supports | Login uses `autocomplete` (username, current-password); other fields aren't about the user |
| 1.4.1 Use of colour | A | Supports | Status / SLA always with text |
| 1.4.2 Audio control | A | Not applicable | |
| 1.4.3 Contrast (minimum) | AA | Supports | Text ≥ 4.5:1 (tokens + readable pipe); axe 0 violations |
| 1.4.4 Resize text | AA | Not yet evaluated | rem-based layout; 200 % zoom check pending |
| 1.4.5 Images of text | AA | Supports | None used |
| 1.4.10 Reflow | AA | Supports | No horizontal scroll at 320 px (all screens) |
| 1.4.11 Non-text contrast | AA | Supports | Icons / borders via readable colours; focus outline brand blue |
| 1.4.12 Text spacing | AA | Not yet evaluated | Truncated text has tooltips; manual check pending |
| 1.4.13 Content on hover or focus | AA | Supports | Tooltips dismiss with Escape, stay on hover |
| 2.1.1 Keyboard | A | Supports | All functions incl. drag alternatives (Move menu, arrows) |
| 2.1.2 No keyboard trap | A | Supports | Dialog trap releases with Escape / close |
| 2.1.4 Character key shortcuts | A | Supports | "/" focuses search only when not typing in a field |
| 2.2.1 Timing adjustable | A | Supports | Toasts are non-essential status messages; session 8 h sliding |
| 2.2.2 Pause, stop, hide | A | Supports | Only a small "timer running" pulse; reduced motion honoured |
| 2.3.1 Three flashes | A | Supports | No flashing content |
| 2.4.1 Bypass blocks | A | Supports | Skip link |
| 2.4.2 Page titled | A | Supports | "<Screen> · nPro" |
| 2.4.3 Focus order | A | Supports | Dialogs move and return focus |
| 2.4.4 Link purpose (in context) | A | Supports | Link text + screen-reader context where needed |
| 2.4.5 Multiple ways | AA | Supports | Menu, global search, links between screens |
| 2.4.6 Headings and labels | AA | Supports | |
| 2.4.7 Focus visible | AA | Supports | 2 px outline on all focusable elements |
| 2.4.11 Focus not obscured (minimum) | AA | Supports | No sticky overlays cover focused items |
| 2.5.1 Pointer gestures | A | Supports | No multipoint / path gestures required |
| 2.5.2 Pointer cancellation | A | Supports | Actions on click (up event) |
| 2.5.3 Label in name | A | Supports | Accessible names contain visible text |
| 2.5.4 Motion actuation | A | Not applicable | |
| 2.5.7 Dragging movements | AA | Supports | Board, backlog, statuses, Gantt have non-drag alternatives |
| 2.5.8 Target size (minimum) | AA | Supports | ≥ 24 × 24 px; tiny Gantt bars use the "equivalent control" exception |
| 3.1.1 Language of page | A | Supports | `lang="en"` |
| 3.1.2 Language of parts | AA | Not applicable | English only |
| 3.2.1 On focus | A | Supports | |
| 3.2.2 On input | A | Supports | Filters update lists only; no unexpected navigation |
| 3.2.3 Consistent navigation | AA | Supports | Same shell on every screen |
| 3.2.4 Consistent identification | AA | Supports | Shared components |
| 3.2.6 Consistent help | A | Supports | Help text in the same places (forms, login footer) |
| 3.3.1 Error identification | A | Supports | Inline errors, `role="alert"` |
| 3.3.2 Labels or instructions | A | Supports | |
| 3.3.3 Error suggestion | AA | Supports | Messages say how to fix (e.g. password rules) |
| 3.3.4 Error prevention (legal, financial, data) | AA | Supports | Confirmation before deletions |
| 3.3.7 Redundant entry | A | Supports | Forms prefill known values |
| 3.3.8 Accessible authentication (minimum) | AA | Supports | Password managers and paste allowed; no cognitive tests |
| 4.1.2 Name, role, value | A | Supports (automated) | Screen-reader confirmation pending |
| 4.1.3 Status messages | AA | Supports | Toasts `role="status"`, errors `role="alert"` |

**Summary (55 criteria):** 45 Supports · 0 Partially supports · 8 Not applicable · 2 Not yet evaluated (1.4.4, 1.4.12); screen-reader confirmation
pending for 1.3.1 and 4.1.2. No known failures. Re-run `npm run a11y` / `a11y:mobile` before each release.
