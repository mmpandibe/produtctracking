# Database Design Document

| | |
|---|---|
| Document ID | NPRO-DB-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| DBMS | Microsoft SQL Server (dev: SQL Express `.\SQLEXPRESS`, database `Npro`) |
| Schema management | EF Core migrations in `server/src/Npro.Infrastructure/Migrations` (`Initial`, `EmployeeId`) |
| Related | ERD NPRO-ERD-001 |

## 1. Conventions
- Primary keys: `nvarchar(64)` string ids (frontend ids such as `u1` or UUIDs).
- Enumerations stored as short strings identical to the frontend (`division_head`, `in_progress`, `l1`).
- Timestamps: `datetimeoffset`.
- Nested structures stored as JSON text columns (EF owned types `ToJson()`, value converters, primitive collections).
- No foreign-key constraints yet (referential checks done by the API); id columns are indexed where queried.

## 2. Tables

| Table | Purpose | Key columns / notes |
|---|---|---|
| People | Users (staff, vendor, client) | Id, Name, Email (unique), Role, Kind, Title, **EmployeeId (unique where not null)**, Phone (legacy), TeamId, ManagerId, VendorId, ClientId, Inactive |
| Divisions | Top of organisation | Id, Name, Description, HeadId, Color |
| Teams | Teams in divisions | Id, DivisionId (idx), Name, ManagerId |
| Vendors | External companies | Id, Name, contact fields, Notes |
| Clients | Client companies | Id, Name, contact fields, Notes, Archived |
| Workflows | Status sets | Id, Name, **Statuses (JSON)**, **Transitions (JSON)** |
| Products | Products | Id, Key (unique), Name, Version, Lifecycle, LeadId, WorkflowId, DivisionId, **ClientIds / MemberIds (JSON)**, IssueCounter, Color, links, CreatedAt, Archived |
| Issues | Tickets | Id, Key (unique), ProductId (idx), Type, Summary, StatusId, Priority, AssigneeId (idx), ReporterId, ClientId, SprintId, ParentId, StoryPoints, **Labels (JSON)**, StartDate, StartAt, EndAt, DueDate, Progress, benefits, Round, Rank, EstimateMinutes, SupportLevel, FirstResponseAt, **CustomFields (JSON)**, CreatedAt, UpdatedAt |
| WorkLogs | Time entries | Id, IssueId (idx), UserId, StartedAt (idx UserId+StartedAt), Minutes, Activity, Note, FromTimer |
| Timers | Running timer per person | UserId (PK), IssueId, Activity, StartedAt |
| Comments | Ticket comments | Id, IssueId (idx), AuthorId, Body, CreatedAt |
| Attachments | File metadata | Id, IssueId (idx), Name, Size, Type, UploadedBy, StorageKey, CreatedAt |
| Activities | History | Id, IssueId (idx), ProductId, UserId, Action, From, To, CreatedAt |
| Roadmaps | Product roadmaps | Id, ProductId (idx), Name, dates, Status, CompletedAt, AchievedBenefits |
| Sprints | Sprints | Id, ProductId (idx), RoadmapId, Name, Goal, State, dates, points |
| CustomFields | Field definitions | Id, ProductId (null = all), Name, Type, **Options (JSON)**, Required |
| AutomationRules | Rules | Id, ProductId, Name, Enabled, **Trigger / Conditions / Actions (JSON)**, RunCount, LastRunAt, RrIndex, **FiredFor (JSON)** |
| AutomationRuns | Run log (latest 300) | Id, RuleId, RuleName, IssueId, IssueKey, Trigger, At (idx), Outcome, **Details (JSON)** |
| SlaPolicies | Targets | Id, Level, Priority (unique pair), ResponseMinutes, ResolutionMinutes |
| SupportLevels | Level settings | Level (PK), Name, Description, TeamId |
| SummaryNotes | CXO comments | Key (PK, e.g. `week:2026-11-23`), Text |
| AspNetUsers, AspNetRoles, AspNetUserClaims, AspNetUserLogins, AspNetUserTokens, AspNetRoleClaims, AspNetUserRoles | ASP.NET Core Identity | AspNetUsers.Id = People.Id; password hash, lockout, security stamp |

## 3. Volumes and growth (estimate)
For 200 users, 20 products, 20 000 tickets/year: Issues ~20 k rows/yr, Activities ~200 k/yr, WorkLogs ~50 k/yr, Comments ~60 k/yr.
Well within SQL Server Standard; SQL Express (10 GB) would also hold several years but lacks TDE and memory headroom.

## 4. Indexing and performance
Unique indexes on keys and emails; indexes on foreign-id columns used in filters. The snapshot endpoint loads tables and filters
in memory — suitable up to tens of thousands of tickets; add paging / server-side filtering beyond that.

## 5. Backup, integrity, security
Full backup daily, log backups hourly (Backup and Restore Procedure). Integrity enforced by the API and unique indexes; adding
FK constraints is planned. Encryption at rest: TDE (Standard / Enterprise) or encrypted EBS volumes; TLS for connections.

## 6. Migrations
`dotnet ef migrations add <Name> -p server/src/Npro.Infrastructure -s server/src/Npro.Api -o Migrations`. The API applies pending
migrations at start-up (`MigrateAsync`). Production: review generated SQL (`dotnet ef migrations script`) before release.
