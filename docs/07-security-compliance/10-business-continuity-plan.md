# Business Continuity Plan (BCP)

| | |
|---|---|
| Document ID | NPRO-BCP-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Business impact analysis

| Business process supported by nPro | Max tolerable downtime | Impact if down |
|---|---|---|
| Support desk (client SLAs) | 4 hours | SLA breaches, client dissatisfaction |
| Daily delivery work (tickets, board) | 1 business day | Lost coordination, delays |
| Time logging | 3 business days | Late / inaccurate logging (recoverable) |
| Reporting / CXO summary | 1 week | Late leadership reporting |
| Leave and corrections | 3 business days | Can be done in the HR system directly |

## 2. Continuity strategies
- **Technical recovery**: Disaster Recovery Plan (RTO 4 h, RPO 1 h).
- **Manual workarounds while nPro is down**:
  - Support: log incoming client requests in a shared mailbox / spreadsheet with received time; enter into nPro afterwards (SLA
    clocks use the original time — record it).
  - Delivery: continue from the last exported board / sprint list; daily stand-up on a whiteboard.
  - Time: record hours offline; enter later.
  - Leave: apply directly in the HR system.
- **People**: at least two people able to deploy and restore (documented procedures); vendor contacts for platform issues.

## 3. Activation
The delivery head or IT lead activates the BCP when an outage exceeds 1 hour in business hours or the DR plan is invoked;
communication to all users, clients with active SLAs, and vendors.

## 4. Communication templates
"nPro is currently unavailable. Please log urgent support requests at <mailbox> with the time received. We expect service back by
<time>. Updates every <n> minutes."

## 5. Testing and maintenance
Tabletop exercise yearly (scenario: database loss during business hours); update contacts quarterly.

| Role | Name | Phone (out of band) |
|---|---|---|
| BCP owner (delivery head) | | |
| IT lead | | |
| Developer on call | | |
| Support desk lead | | |
