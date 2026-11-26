# UI/UX Design Document

| | |
|---|---|
| Document ID | NPRO-UX-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Design principles
1. **Compact and calm**: light frosted-blue glass panels, Inter font, 14 px root size, small type (11–13 px), dense rows.
2. **One scroll**: only the browser window scrolls; tables collapse columns and become cards on phones.
3. **Scoped**: people only see menus and data their role allows.
4. **Accessible**: WCAG 2.2 AA; every drag action has a menu / button alternative.
5. **Fast feedback**: toasts for actions, inline errors, live SLA clocks.

## 2. Layout
- **Shell**: collapsible sidebar (Work / Insights / Admin sections; icon rail when collapsed; drawer on phones), top bar with
  global search ("/" or Ctrl+K), running-timer pill, account popover (sign out, demo switcher in development).
- **Page**: page header (title + actions), filter bar (glass strip), content (cards / tables), dialogs (modal with focus trap).

## 3. Visual system (tokens in `src/styles.css`)

| Token | Value | Use |
|---|---|---|
| `--color-ink` | `#1f2a37` | Text; secondary text never lighter than `text-ink/70` |
| `--color-brand` | `#0b5fd9` | Links, primary buttons, focus outline (darkened from `#1677ff` for 4.5:1) |
| Accent tokens | blue `#1d5fd1`, pink `#b8327a`, green `#166534`, coral `#b7410e`, yellow `#92400e` | Stats, charts |
| Data colours | status / priority / level colours | Passed through the `readable` pipe for text and icons |
| Components | `.glass`, `.glass-strong`, `.input`, `.label`, `.btn-primary/secondary/danger`, `.icon-btn`, `.chip`, `.tag`, `.pill`, `.muted-row` | Shared building blocks |

## 4. Screen inventory
Dashboard (My day / My team), My Requests, Products (cards / list), Tickets (list, dialog, detail), Board, Backlog & Sprints,
Time Tracking, Attendance & Hours, Gantt & Roadmap, Support Desk, Reports, CXO Summary, Clients, Workflows & Fields, Organisation,
Integrations, Automation, Login.

## 5. Interaction patterns
| Pattern | Rule |
|---|---|
| Lists | Table on md+ (fixed layout, truncation with tooltip), cards on phones |
| Status / priority | Outlined pill with colour + text (never colour alone) |
| Drag and drop | Board, backlog, statuses, Gantt — always with a click / keyboard alternative ("Move" menu, arrows) |
| Dialogs | `app-modal`: focus moves to the first field, Tab stays inside, Escape closes, focus returns |
| Destructive actions | Confirmation dialog stating what is deleted |
| Errors | Inline under the field (`role="alert"`); sync errors as a red banner |
| Empty states | Icon, one-line explanation, primary action |

## 6. Responsive breakpoints
Tailwind defaults: sm 640, md 768, lg 1024, xl 1280, 2xl 1536. Verified at 320 px, 375 px, 768 px, 1366 px.
Product grid: 1 / 2 / 3 / 4 / 5 cards per row.

## 7. Content style
Plain English, sentence case, short labels; numbers with units ("8h 30m"); dates `MMM d` / `MMM d, y`.

## 8. Usability validation
Planned: moderated UAT sessions per role (see UAT Sign-off), screen-reader walkthrough (NVDA, VoiceOver).
