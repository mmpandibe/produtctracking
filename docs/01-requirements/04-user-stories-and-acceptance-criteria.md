# User Stories & Acceptance Criteria

| | |
|---|---|
| Document ID | NPRO-US-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Related | SRS NPRO-SRS-001 (FR IDs) · Test Cases NPRO-TC-001 |

Format: *As a … I want … so that …*, followed by acceptance criteria (Given / When / Then, shortened). Each story names the SRS
requirement it delivers.

## Products & tickets

**US-01 (FR-01)** As a division head I want to create a product with a key, lead, division, members and clients so that my teams can track work on it.
- Given I have the products capability, when I save a product with key "sd", then it is stored as "SD" and appears in Products.
- A product key must be unique; a duplicate key shows an error.
- Archiving hides the product from default lists; only an admin or the division head can delete it.

**US-02 (FR-01)** As any staff member I want product cards with progress and ticket counts so that I see status at a glance.
- Cards show lifecycle, version, clients, % done, done/total tickets, lead and start month; up to 5 cards per row on wide screens.

**US-03 (FR-02)** As a developer I want to create a ticket with type, priority, assignee, sprint and dates so that work is planned.
- The ticket gets the next key for its product (e.g. WEB-7), assigned by the server.
- The reporter is the signed-in person; assignees are active staff only.

**US-04 (FR-02)** As a team member I want to filter the ticket list by product, client, status, assignee, priority and type so that I find work quickly.
- Filters combine; status counts ignore the status filter; search matches key and summary; `?product=`, `?assignee=`, `?q=` links work.

**US-05 (FR-03)** As a team member I want to comment, attach files and see the full history on a ticket so that context stays in one place.
- Every change creates a history entry naming who changed what; automation entries show "Automation".

## Board, backlog, roadmaps

**US-06 (FR-04)** As a tech lead I want to move cards between workflow columns so that the board reflects progress.
- Moves the workflow forbids are refused with a message.
- The same move is possible without dragging (card "Move" menu: up, down, to status).

**US-07 (FR-05)** As a tech lead I want to plan, start and complete sprints so that we deliver in iterations.
- Completing a sprint records committed and completed points and moves unfinished tickets to the chosen sprint or backlog.

**US-08 (FR-06)** As a business analyst I want roadmaps with linked sprints and benefits so that leadership sees goals and progress.
- % complete is calculated from story points of the roadmap's sprints.

**US-09 (FR-15)** As a business analyst I want to drag roadmap, sprint and ticket bars on a Gantt chart so that I can replan dates quickly.
- Only people with the matching capability can move bars; completed sprints can't be moved; arrow keys move a selected bar by a day.

## Time, attendance, productivity

**US-10 (FR-07)** As a developer I want to start / stop a timer on a ticket so that my time is logged accurately.
- Starting a new timer stops and logs the running one; only one timer per person.

**US-11 (FR-07)** As an assistant manager I want a weekly team timesheet so that I can review logged hours.
- Developers and testers see only their own time.

**US-12 (FR-16)** As a developer I want to apply for sick or casual leave (including half days) so that my manager can approve it.
- Weekend-only ranges and overlapping leave are refused; balances are shown.

**US-13 (FR-16)** As a developer I want to correct a missed punch so that my attendance is accurate.
- Only past days; punch-out must be after punch-in; the request waits for approval.

**US-14 (FR-16)** As a manager I want to approve or reject leave and corrections for the people reporting to me so that records stay correct.
- Nobody approves their own requests; admins can approve anyone's.

**US-15 (FR-16, FR-18)** As a manager I want to compare productive, logged and attended hours per person so that I can spot under-logging.

## Support

**US-16 (FR-14)** As a support engineer I want an L1 queue with SLA clocks so that I answer tickets in time.
- Clocks show running / at risk (≤ 25 % left) / breached / met; breached first.

**US-17 (FR-14)** As a support engineer I want to escalate a ticket to the next level with a reason so that the right team takes it.
- Escalation moves L1 → L2 → L3, clears the assignee, adds the reason as a comment and a history entry.

**US-18 (FR-14)** As an admin I want to set SLA targets per level and priority so that targets match our contracts.

## Organisation & access

**US-19 (FR-12)** As an admin I want to set up divisions, teams, people and vendors so that access follows the organisation.
- Internal people require a unique employee ID (stored upper-case); vendor people require a vendor; client people a client.

**US-20 (FR-13)** As a division head I want to see only my division's products and people so that data stays scoped.
- The server returns only scoped data; a hidden ticket link shows "You don't have access".

**US-21 (FR-13)** As a client user I want "My Requests" so that I can raise tickets and follow them.
- I see only tickets I raised or my company's; I can comment but not edit tickets.

**US-22 (FR-20)** As any user I want to sign in with my email or employee ID so that I can reach my work.
- 5 wrong passwords lock the account for 5 minutes; the error doesn't reveal whether the account exists.

**US-23 (FR-20)** As an admin I want to set a person's password so that new people can sign in.
- Passwords need ≥ 10 characters with upper, lower case and a digit.

## Workflows, automation, reports

**US-24 (FR-11)** As an admin I want to edit workflow statuses and allowed transitions so that the process matches ours.
- Statuses can be reordered by drag or arrow buttons; deleting a status requires a replacement for its tickets.

**US-25 (FR-11)** As an admin I want custom fields per product so that we capture product-specific data.

**US-26 (FR-19)** As an admin I want "when / if / then" automation rules so that routine handling happens automatically.
- Rules run on the server as "Automation"; blocked status moves are skipped and logged; a rule never re-runs within its own chain.

**US-27 (FR-19)** As a division head I want breached L1 tickets escalated automatically so that nothing waits too long.
- Timed rules run every minute, once per ticket.

**US-28 (FR-09)** As a manager I want product-wise and client-wise reports with CSV export so that I can analyse delivery.

**US-29 (FR-10)** As the head of delivery I want a weekly / monthly CXO summary so that leadership gets a consistent update.
- Shows KPIs vs the previous period, highlights, roadmap summary and hours client × product; exports to PDF / CSV / text.

## Dashboards & search

**US-30 (FR-18)** As a developer I want "My day" so that I see my tickets, hours and leave in one place.

**US-31 (FR-18)** As a manager I want "My team" so that I see attendance today, workload, sprints and SLA breaches.

**US-32 (FR-18)** As any user I want global search ("/" or Ctrl+K) so that I can jump to tickets, products, people and pages.
- Results only include what I may see.

## Platform

**US-33 (FR-21)** As a user I want my changes saved to the server and others' changes to appear without reloading so that we work on the same data.
- Refused changes show "Not saved" and the server's version is reloaded; updates from others appear within 30 s.

**US-34 (FR-22)** As a presenter I want the app to run as a demo without a server so that I can show it anywhere.

**US-35 (NFR-01)** As a keyboard or screen-reader user I want every function to work without a mouse so that I can use nPro fully.
- Skip link, visible focus, dialogs trap and return focus, drag actions have menu alternatives, 24 px targets.
