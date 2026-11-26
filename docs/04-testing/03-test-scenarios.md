# Test Scenarios

| | |
|---|---|
| Document ID | NPRO-TST-SCN-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

High-level scenarios; detailed steps are in Test Cases (NPRO-TC-001).

| ID | Scenario | Requirements |
|---|---|---|
| TS-01 | Admin sets up a division, team, people (with employee IDs) and a vendor | FR-12 |
| TS-02 | Division head creates a product with members and clients; archives and restores it | FR-01 |
| TS-03 | Developer creates, edits, comments on and logs time against a ticket | FR-02, FR-03, FR-07 |
| TS-04 | Tech lead runs a sprint from planning to completion with unfinished work moved | FR-05 |
| TS-05 | Tech lead moves cards on the board by drag and by the Move menu; forbidden transitions are refused | FR-04, FR-11 |
| TS-06 | BA creates a roadmap, links sprints and reschedules on the Gantt | FR-06, FR-15 |
| TS-07 | Client user raises a request, sees only their company's tickets, comments, cannot edit | FR-13, FR-21 |
| TS-08 | Support engineer works the L1 queue, takes a ticket, escalates it to L2 | FR-14 |
| TS-09 | SLA breach triggers the "Escalate breached L1" rule on the server | FR-14, FR-19 |
| TS-10 | Admin enables round-robin; new support tickets are assigned in turn | FR-19 |
| TS-11 | Developer applies for leave and corrects a missed punch; manager approves | FR-16 |
| TS-12 | Manager compares productive vs logged vs attended hours | FR-16, FR-18 |
| TS-13 | Head of delivery prepares and exports the weekly CXO summary | FR-10 |
| TS-14 | Manager exports product-wise and client-wise reports as CSV | FR-09 |
| TS-15 | Users sign in with email and with employee ID; lockout after 5 failures; sign out | FR-20 |
| TS-16 | Two users create tickets on the same product at the same time; numbers are unique | FR-21 |
| TS-17 | A change by one user appears for another user within 30 s | FR-21 |
| TS-18 | A crafted API call tries to edit data outside the caller's scope; it is refused and nothing is saved | FR-13, NFR-02, NFR-08 |
| TS-19 | Keyboard-only and screen-reader user completes TS-03 and TS-05 | NFR-01 |
| TS-20 | All screens at 320 px width without horizontal scrolling | NFR-05 |
| TS-21 | App opened without a server runs the offline demo | FR-22 |
| TS-22 | Global search finds tickets / people / pages within scope | FR-18 |
