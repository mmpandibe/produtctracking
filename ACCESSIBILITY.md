# nPro — Accessibility (WCAG 2.2 Level AA)

Status as of 2026-11-26. Target: **WCAG 2.2 Level AA** for the Angular web app (all screens, dialogs and the login page).

## Result

| Check | Result |
|---|---|
| Automated scan — axe-core 4.14, rules for WCAG 2.0 / 2.1 / 2.2 A + AA and best practices, 30 screens and dialog states + login, at 1366 px and 320 px | **0 violations** (before the fixes: 9 rule types failing across every screen) |
| Reflow (1.4.10) at 320 px wide | **No horizontal scrolling** on any screen |
| Keyboard (2.1.1, 2.4.3, 2.4.7) — skip link, dialogs, move menus | Verified (see below) |
| Screen reader with NVDA / JAWS / VoiceOver | **Not yet done** — recommended before claiming formal conformance |

Automated tools catch roughly a third to half of WCAG problems, so the manual checks below matter. A formal conformance claim
(e.g. a VPAT) should also include a screen-reader pass and a review by someone who uses assistive technology.

Re-run the scan any time with the app running (`npm.cmd start`; without the API it runs the local demo as the admin):

```powershell
npm.cmd run a11y
```

```powershell
npm.cmd run a11y:mobile
```

(`scripts/a11y-scan.cjs` drives headless Edge / Chrome; `A11Y_BASE` sets the address, default http://localhost:4200. It exits with 1
when it finds a problem, so it can run in CI.)

## What was fixed

| WCAG 2.2 criterion | Problem found | Fix |
|---|---|---|
| 1.4.3 Contrast (minimum) | Secondary grey text (`text-ink/35`–`/65`) was 2.0–4.4:1 on the glass panels; brand blue `#1677ff` 3.6–4.1:1 (also white text on blue buttons); status / priority / level colours down to 2.1:1; faded rows (done, archived, deactivated) used opacity | Secondary text is now `text-ink/70` (≥ 5.1:1), placeholders `/65`; brand `#0b5fd9` (5.0:1 on glass, white on brand 5.8:1); accent tokens darkened; a `readable` pipe (`shared/readable.ts`) darkens any data colour used as text or icon until it reaches 4.5:1 (same hue); faded rows now use a light tint (`.muted-row`) instead of opacity; badges with white text use darker fills |
| 1.4.11 Non-text contrast | Icons tinted with pale data colours | Covered by the `readable` pipe |
| 1.4.10 Reflow | CXO summary roadmap table needed 363 px at a 320 px viewport | Columns rearranged for phones |
| 1.4.13 Content on hover or focus | Chart tooltips and sidebar tooltips couldn't be dismissed without moving the pointer | Escape closes them |
| 2.1.2 / 2.4.3 Focus order (dialogs) | Dialogs didn't take focus, Tab could leave them, and focus wasn't returned | Every dialog traps focus (Angular CDK), starts on its first field, closes on Escape and returns focus to the button that opened it; named by its heading (`aria-labelledby`) |
| 2.4.1 Bypass blocks | No way to skip the menu | "Skip to main content" link (first Tab stop) |
| 2.4.7 / 2.4.11 Focus visible / not obscured | Some controls removed the outline (status pills, global search) | One clear 2 px brand outline on every focusable element (`:focus-visible`); the search field shows a ring |
| 2.5.3 Label in name | Account button's name didn't contain its visible text; Gantt bar names didn't start with the bar label | Names now start with the visible text |
| 2.5.7 Dragging movements (new in 2.2) | Board cards, backlog rows and workflow statuses could only be reordered / moved by dragging | A "Move" menu on every board card (move up / down / to any allowed status) and backlog row (up / down / to any sprint or the backlog); up / down arrow buttons for workflow statuses. Gantt bars already had arrow-key moves and edit forms |
| 2.5.8 Target size (minimum) (new in 2.2) | Icon-only buttons and list links under 24 × 24 px; the automation on/off switch was 16 px tall | Icon-only buttons and links are at least 24 × 24 CSS px; links in lists 24 px tall; switch 24 × 42 px. Note: the app's root font is 14 px, so 24 px targets use px values, not `h-6` (21 px) |
| 4.1.2 Name, role, value | Gantt bars used `role="slider"` without a value; coloured dots and drag handles had labels without a role; empty table headers | Bars are buttons (Enter opens, arrows move dates); dots are `role="img"`; decorative drag handles hidden from assistive tech; header cells labelled "Actions" (screen-reader only) |
| 1.3.1 Info and relationships | Login page had no `main` landmark; a second unnamed `aside` | Landmarks named / added |
| 2.3.3 (AAA, good practice) | — | Animations are switched off when the system's "reduce motion" setting is on |

Already in place and verified: page language (`lang="en"`), page titles per screen, labelled form fields, errors announced
(`role="alert"`), toasts announced (`role="status"`), sign-in that works with password managers and paste (3.3.8), no time limits
on tasks (the session lasts 8 hours of activity).

## Rules for new screens

- Secondary text: never lighter than `text-ink/70`. Primary text `text-ink`.
- Brand blue is `#0b5fd9` (`text-brand`, `bg-brand`); don't reintroduce `#1677ff` for text or white-on-blue.
- Any colour that comes from data (status, priority, product …) and is used as text or an icon goes through `| readable`.
- Don't fade content with `opacity`; use `.muted-row` or a label ("Done", "Deactivated").
- Icon-only buttons need an `aria-label`; targets at least 24 × 24 px (use px, the root font is 14 px).
- Anything you can drag must also be possible with clicks / keys (use `app-move-menu` for lists).
- Dialogs: use `app-modal` (focus handling is built in) and mark the first field `autofocus`.
- Run `npm.cmd run a11y` and `npm.cmd run a11y:mobile` before finishing a screen.

## Known limits / to check manually

- **Screen-reader pass** (NVDA + Chrome / Edge, VoiceOver on iOS) of the main flows: sign in, raise a ticket, move a ticket, log time,
  apply for leave, approve a request.
- **Charts** (bar / line charts, Gantt) show their numbers next to them or in tables, but a screen-reader user hears them as lists;
  a "view as table" toggle would be better.
- **Text spacing (1.4.12)** and **200 % zoom (1.4.4)**: the layout is rem-based and reflows at 320 px, but long names truncate with an
  ellipsis (full text is in the tooltip / detail page); worth a manual pass with a text-spacing bookmarklet.
- **Gantt**: a bar narrower than 24 px isn't a separate keyboard target; its row label link and the ticket / sprint / roadmap edit
  form do the same thing (2.5.8 "equivalent" exception).
