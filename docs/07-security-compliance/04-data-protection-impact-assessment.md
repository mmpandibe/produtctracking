# Data Protection Impact Assessment (DPIA)

| | |
|---|---|
| Document ID | NPRO-DPIA-001 |
| Version | 1.0 (draft for DPO review) · 27 Nov 2026 |
| Status | **Required before go-live** — attendance and laptop productivity monitoring of employees is high-risk processing |

## 1. Description of processing
nPro combines work tracking (tickets, comments, time logs) with **attendance** (punch in / out, late arrivals, missed punches),
**leave** (sick / casual, half days, balances) and **laptop productivity** (active, productive and idle minutes per day) imported
from external systems, shown on dashboards to the person and their managers, and compared with logged hours.

## 2. Necessity and proportionality
| Question | Assessment |
|---|---|
| Purpose | Workforce planning, delivery management, accurate effort reporting to clients |
| Necessary? | Logged hours and attendance: yes for client billing / capacity. Productivity minutes: useful but intrusive — justify per purpose |
| Less intrusive alternatives | Show team aggregates instead of per-person productivity; daily totals only (no app-level details — nPro stores none); allow opting out where not contractually required |
| Data minimised? | Daily totals only; no screenshots, keystrokes, URLs or app names; no diagnosis for sick leave |
| Who sees it | The person; managers who have them in scope (division head, assistant manager, admins); developers / testers see only themselves |

## 3. Risks to individuals

| Risk | Likelihood | Severity | Measures | Residual |
|---|---|---|---|---|
| Surveillance feeling / chilling effect | Likely | Significant | Transparency notice; aggregate views; no keystroke / screen data; consultation | Medium |
| Unfair decisions based on productivity numbers | Possible | Significant | Policy: numbers are indicators, never sole basis for decisions; no automated decisions | Low–medium |
| Disclosure of sick leave to colleagues | Possible | Significant | Scope limits; only "sick" type shown to managers; colleagues without scope can't see | Low |
| Unauthorised access / breach | Unlikely | Severe | Security controls, encryption, access reviews | Low |
| Excessive retention | Possible | Moderate | Retention: attendance / productivity 13 months, then aggregate or delete | Low |
| Inaccurate data (missed punches) | Likely | Minor | Correction workflow with approval | Low |

## 4. Consultation
Employee representatives / works council (where applicable), HR, Legal, information security — to be held before go-live.

## 5. Measures summary
Privacy notice; legal basis confirmed; per-person productivity view restricted to the person and their managers (team aggregates
preferred); retention automation; access reviews quarterly; DPO approval; review annually or when the HR / tracker integration
changes.

## 6. Sign-off
| Role | Decision | Name | Date |
|---|---|---|---|
| Data protection officer | ☐ Approve ☐ Approve with conditions ☐ Reject | | |
| HR director | | | |
| Product owner | | | |
