# Data Flow Diagram (DFD)

| | |
|---|---|
| Document ID | NPRO-DFD-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## Level 0 — context

```mermaid
flowchart LR
  U((Users)) -- credentials, actions, comments, time, leave --> P0[nPro]
  P0 -- screens, reports, summaries --> U
  HR[(Attendance / leave system)] -. punches, leave, balances .-> P0
  P0 -. leave requests, corrections, approvals .-> HR
  PT[(Productivity tracker)] -. active / productive / idle minutes .-> P0
  P0 <--> D[(nPro database)]
```

## Level 1 — main processes

```mermaid
flowchart TB
  U((User)) -->|login / employee ID + password| P1[1. Authenticate]
  P1 -->|cookie| U
  P1 <--> D1[(AspNetUsers / People)]
  U -->|GET state| P2[2. Build scoped snapshot]
  P2 <--> D2[(All nPro tables)]
  P2 -->|DataState + version| U
  U -->|changed records| P3[3. Authorise & save changes]
  P3 --> D2
  P3 -->|events| P4[4. Rule engine]
  P4 <--> D2
  P3 -->|version, server changes| U
  T(("Clock, every minute")) --> P5[5. Timed rules]
  P5 --> P4
  U -->|poll version| P6[6. Change feed]
  P5 --> P6
  P3 --> P6
  U -->|attendance screens| P7[7. Attendance & productivity adapters]
  P7 -.->|sample now, backend proxy later| HR[(HR system)]
  P7 -.->|sample now, backend proxy later| PT[(Tracker)]
```

## Data stores
| Store | Data |
|---|---|
| D1 | Sign-in accounts (password hashes, lockout), people |
| D2 | Organisation, products, tickets, comments, time, history, rules, SLA settings |
| Browser (offline demo only) | localStorage `npro-data`, `npro-integrations`, `npro-ext-sample`; IndexedDB attachment bytes |
| Browser (server mode) | In-memory copy of the snapshot; cookies `npro.auth`, `npro.af`, `XSRF-TOKEN` |

## Trust boundaries
Browser ↔ IIS (TLS); IIS ↔ SQL Server (TLS, Windows / SQL auth); nPro ↔ external systems (server-side, keys in a secret store).
