# Entity Relationship Diagram (ERD)

| | |
|---|---|
| Document ID | NPRO-ERD-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

Relationships are logical (enforced by the API; FK constraints planned). JSON columns are shown as attributes.

```mermaid
erDiagram
  DIVISION ||--o{ TEAM : has
  DIVISION |o--o| PERSON : "headed by"
  TEAM |o--o| PERSON : "managed by"
  TEAM ||--o{ PERSON : "member of"
  PERSON |o--o{ PERSON : "reports to"
  VENDOR ||--o{ PERSON : employs
  CLIENT ||--o{ PERSON : "client user"
  DIVISION ||--o{ PRODUCT : owns
  PERSON ||--o{ PRODUCT : leads
  WORKFLOW ||--o{ PRODUCT : "used by"
  PRODUCT }o--o{ CLIENT : "clientIds (JSON)"
  PRODUCT }o--o{ PERSON : "memberIds (JSON)"
  PRODUCT ||--o{ ISSUE : contains
  PRODUCT ||--o{ ROADMAP : plans
  PRODUCT ||--o{ SPRINT : runs
  ROADMAP |o--o{ SPRINT : groups
  SPRINT |o--o{ ISSUE : holds
  ISSUE |o--o{ ISSUE : "parent of"
  PERSON |o--o{ ISSUE : "assignee / reporter"
  CLIENT |o--o{ ISSUE : "raised for"
  ISSUE ||--o{ COMMENT : has
  ISSUE ||--o{ ATTACHMENT : has
  ISSUE ||--o{ WORKLOG : "time logged"
  ISSUE ||--o{ ACTIVITY : history
  PERSON ||--o| TIMER : runs
  PRODUCT |o--o{ CUSTOMFIELD : "defines (or all)"
  PRODUCT |o--o{ AUTOMATIONRULE : "scope (or all)"
  AUTOMATIONRULE ||--o{ AUTOMATIONRUN : logs
  SUPPORTLEVEL |o--o| TEAM : "handled by"
  PERSON ||--|| ASPNETUSER : "sign-in account"

  PERSON {
    string Id PK
    string Email UK
    string EmployeeId UK
    string Role
    string Kind
    bool Inactive
  }
  PRODUCT {
    string Id PK
    string Key UK
    int IssueCounter
    json ClientIds
    json MemberIds
  }
  ISSUE {
    string Id PK
    string Key UK
    string StatusId
    string Priority
    string SupportLevel
    json Labels
    json CustomFields
  }
  WORKFLOW {
    string Id PK
    json Statuses
    json Transitions
  }
  AUTOMATIONRULE {
    string Id PK
    bool Enabled
    json Trigger
    json Conditions
    json Actions
    json FiredFor
  }
  SLAPOLICY {
    string Id PK
    string Level
    string Priority
    int ResponseMinutes
    int ResolutionMinutes
  }
```

Standalone tables: SLAPOLICY (level × priority), SUMMARYNOTE (period key → text), Identity tables (AspNet*).
