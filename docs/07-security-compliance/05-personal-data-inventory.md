# Personal Data Inventory

| | |
|---|---|
| Document ID | NPRO-PDI-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

| # | Data category | Fields | Data subjects | Source | Stored in | Sensitivity | Access | Retention (proposed) |
|---|---|---|---|---|---|---|---|---|
| 1 | Identity & contact | Name, work email, job title, employee ID, (legacy phone) | Employees, vendor staff, client users | Admin entry | `People` | Personal | All staff in scope (names / emails); admins | Active + 2 years after deactivation, then anonymise |
| 2 | Organisation | Role, kind, team, manager, vendor, client, products, inactive flag | Same | Admin entry | `People`, `Products` | Personal | Staff in scope | As #1 |
| 3 | Credentials | Password hash, security stamp, lockout counters, email (username) | All users | User / admin | `AspNetUsers` | Restricted | System only | Deleted with the account |
| 4 | Work records | Tickets raised / assigned, comments, attachments, history entries | All users | Users | `Issues`, `Comments`, `Attachments`, `Activities` | Personal (may contain free text) | Per product scope | Life of the product + 5 years (business records) |
| 5 | Time logs | Date, minutes, activity, note, timer | Staff | Users | `WorkLogs`, `Timers` | Personal | Person; managers in scope; admins | 7 years (financial / billing evidence) — confirm |
| 6 | Attendance | Punch in / out, worked minutes, late flag, status | Employees, vendor staff | HR system (adapter) | Not stored by nPro in server mode today (fetched per request); sample data in browser storage | Personal | Person; managers in scope | Source system rules; any nPro cache ≤ 13 months |
| 7 | Leave | Type (sick / casual), dates, half day, reason, status, approver | Employees, vendor staff | User → HR system | HR system (via adapter) | **Special category (health) for sick leave** | Person; approvers | Source system rules |
| 8 | Productivity | Active / productive / idle minutes per day | Employees, vendor staff | Laptop tracker | Fetched per request; not persisted by nPro | Personal (monitoring) | Person; managers in scope | ≤ 13 months if cached |
| 9 | Client contacts | Contact name, email, phone | Client staff | Admin entry | `Clients` | Personal | Staff with client in scope | Contract + 2 years |
| 10 | Vendor contacts | Contact name, email, phone | Vendor staff | Admin entry | `Vendors` | Personal | Staff | Contract + 2 years |
| 11 | Session / security | Auth cookie, XSRF tokens; server logs (IP, user, path, time) | All users | System | Browser cookies; IIS / app logs | Personal | IT | Cookies: session (8 h sliding); logs 12 months |
| 12 | Automation log | Rule runs on tickets (rule, ticket, outcome) | Indirect | System | `AutomationRuns` | Low | Staff in scope | Latest 300 entries |
| 13 | CXO comments | Free text per period | Indirect (may name people) | Leadership | `SummaryNotes` | Personal (possible) | Summary capability | 3 years |

Third parties receiving data: none outbound today except the font CDN request (IP address) — to be removed. Planned: HR system
(leave requests / decisions outbound).
