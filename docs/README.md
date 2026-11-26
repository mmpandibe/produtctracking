# nPro — Project Documentation

Version 1.0 (draft) · 27 Nov 2026 · describes the development build at commit `1cd0b22` (Steps 1–18c).

**How to read the status column**
- **Complete**: describes the product as built, with measured results.
- **Template / plan**: the procedure or form is ready; the results are filled in when the activity happens (UAT, deployment,
  incidents, monitoring).
- **N/A**: does not apply to nPro, with the reason stated.

Requirement IDs (BR, FR, NFR), user stories (US), test cases (TC) and risks (R, SR) are shared across documents. The SRS defines
FR / NFR, and the RTM links them to design, code and tests.

## 1. Requirement Analysis & Planning
| # | Document | Status |
|---|---|---|
| 1 | [Business Requirement Document (BRD)](01-requirements/01-business-requirements-document.md) | Complete (draft for approval) |
| 2 | [Product Requirement Document (PRD)](01-requirements/02-product-requirements-document.md) | Complete |
| 3 | [Software Requirement Specification (SRS)](01-requirements/03-software-requirements-specification.md) | Complete |
| 4 | [User Stories & Acceptance Criteria](01-requirements/04-user-stories-and-acceptance-criteria.md) | Complete |
| 5 | [Requirement Traceability Matrix (RTM)](01-requirements/05-requirement-traceability-matrix.md) | Complete |
| 6 | [Project Plan](01-requirements/06-project-plan.md) | Complete (timeline proposed) |
| 7 | [Feasibility Study Report](01-requirements/07-feasibility-study-report.md) | Complete |
| 8 | [Risk Assessment Document](01-requirements/08-risk-assessment-document.md) | Complete (living document) |

## 2. System Design & Architecture
| # | Document | Status |
|---|---|---|
| 1 | [High-Level Design (HLD)](02-design/01-high-level-design.md) | Complete |
| 2 | [Low-Level Design (LLD)](02-design/02-low-level-design.md) | Complete |
| 3 | [Solution Architecture Document](02-design/03-solution-architecture-document.md) | Complete |
| 4 | [Database Design Document](02-design/04-database-design-document.md) | Complete |
| 5 | [Entity Relationship Diagram (ERD)](02-design/05-entity-relationship-diagram.md) | Complete |
| 6 | [API Specification Document](02-design/06-api-specification-document.md) | Complete |
| 7 | [UI/UX Design Document](02-design/07-ui-ux-design-document.md) | Complete |
| 8 | [Data Flow Diagram (DFD)](02-design/08-data-flow-diagram.md) | Complete |
| 9 | [Security Architecture Document](02-design/09-security-architecture-document.md) | Complete (gaps listed) |
| 10 | [Integration Design Document](02-design/10-integration-design-document.md) | Complete (live APIs pending details) |
| 11 | [Infrastructure Architecture Document](02-design/11-infrastructure-architecture-document.md) | Target design (no AWS access yet) |

## 3. Software Development
| # | Document | Status |
|---|---|---|
| 1 | [Software Development Plan](03-development/01-software-development-plan.md) | Complete |
| 2 | [Software Development Standards](03-development/02-software-development-standards.md) | Complete |
| 3 | [Coding Standards Document](03-development/03-coding-standards-document.md) | Complete |
| 4 | [Source Code Repository Guidelines](03-development/04-source-code-repository-guidelines.md) | Complete |
| 5 | [Code Review Checklist](03-development/05-code-review-checklist.md) | Complete |
| 6 | [Technical Design Specifications](03-development/06-technical-design-specifications.md) | Complete |
| 7 | [Configuration Management Plan](03-development/07-configuration-management-plan.md) | Complete |
| 8 | [Third-Party Component Register](03-development/08-third-party-component-register.md) | Complete (scanned 27 Nov 2026) |
| 9 | [Developer Documentation](03-development/09-developer-documentation.md) | Complete |

## 4. Testing & Quality Assurance
| # | Document | Status |
|---|---|---|
| 1 | [Test Strategy Document](04-testing/01-test-strategy-document.md) | Complete |
| 2 | [Test Plan](04-testing/02-test-plan.md) | Complete |
| 3 | [Test Scenarios](04-testing/03-test-scenarios.md) | Complete |
| 4 | [Test Cases](04-testing/04-test-cases.md) | Complete (71 cases) |
| 5 | [Test Execution Report](04-testing/05-test-execution-report.md) | Complete for development testing |
| 6 | [Defect/Bug Tracking Report](04-testing/06-defect-bug-tracking-report.md) | Complete (11 found, 0 open) |
| 7 | [Regression Testing Report](04-testing/07-regression-testing-report.md) | Complete |
| 8 | [Performance Testing Report](04-testing/08-performance-testing-report.md) | Local baseline measured; load test planned |
| 9 | [Security Testing Report](04-testing/09-security-testing-report.md) | Development testing done; pen test pending |
| 10 | [Vulnerability Assessment Report](04-testing/10-vulnerability-assessment-report.md) | Dependencies scanned; infra scan pending |
| 11 | [User Acceptance Testing (UAT) Sign-off](04-testing/11-uat-sign-off.md) | Template (UAT not yet run) |
| 12 | [Accessibility Testing Report](04-testing/12-accessibility-testing-report.md) | Complete (screen-reader pass pending) |

## 5. Deployment & Release Management
| # | Document | Status |
|---|---|---|
| 1 | [Deployment Plan](05-deployment/01-deployment-plan.md) | Complete (parts depend on Step 18d) |
| 2 | [Release Management Document](05-deployment/02-release-management-document.md) | Complete |
| 3 | [Release Notes](05-deployment/03-release-notes.md) | Complete (development build 0.9) |
| 4 | [Rollback Plan](05-deployment/04-rollback-plan.md) | Complete |
| 5 | [Production Readiness Checklist](05-deployment/05-production-readiness-checklist.md) | Assessed — not ready yet |
| 6 | [Environment Configuration Document](05-deployment/06-environment-configuration-document.md) | Complete |
| 7 | [Deployment Sign-off](05-deployment/07-deployment-sign-off.md) | Template |
| 8 | [Disaster Recovery Plan](05-deployment/08-disaster-recovery-plan.md) | Complete (not yet tested) |

## 6. Product Maintenance & Support
| # | Document | Status |
|---|---|---|
| 1 | [Software Maintenance Plan](06-maintenance/01-software-maintenance-plan.md) | Complete |
| 2 | [Change Request (CR) Document](06-maintenance/02-change-request-document.md) | Complete (process, form, log) |
| 3 | [Incident Management Report](06-maintenance/03-incident-management-report.md) | Template (no production incidents) |
| 4 | [Problem Management Report](06-maintenance/04-problem-management-report.md) | Complete (4 problems logged) |
| 5 | [Root Cause Analysis (RCA) Report](06-maintenance/05-root-cause-analysis-report.md) | Complete (real RCA + template) |
| 6 | [Patch Management Document](06-maintenance/06-patch-management-document.md) | Complete |
| 7 | [System Monitoring Report](06-maintenance/07-system-monitoring-report.md) | Template + monitoring design |
| 8 | [Backup and Restore Procedure](06-maintenance/08-backup-and-restore-procedure.md) | Complete |
| 9 | [Knowledge Base / User Manual](06-maintenance/09-knowledge-base-user-manual.md) | Complete |
| 10 | [SLA Document](06-maintenance/10-sla-document.md) | Complete (draft for agreement) |
| 11 | [End-of-Life (EOL) Plan](06-maintenance/11-end-of-life-plan.md) | Complete |

## 7. Security, Privacy & Compliance
| # | Document | Status |
|---|---|---|
| 1 | [Information Security Policy](07-security-compliance/01-information-security-policy.md) | Complete (draft for approval) |
| 2 | [Security Risk Assessment](07-security-compliance/02-security-risk-assessment.md) | Complete |
| 3 | [Data Protection and Privacy Policy](07-security-compliance/03-data-protection-and-privacy-policy.md) | Draft — governing law to confirm |
| 4 | [Data Protection Impact Assessment (DPIA)](07-security-compliance/04-data-protection-impact-assessment.md) | Draft for DPO review |
| 5 | [Personal Data Inventory](07-security-compliance/05-personal-data-inventory.md) | Complete |
| 6 | [Data Retention and Deletion Policy](07-security-compliance/06-data-retention-and-deletion-policy.md) | Draft — periods to confirm |
| 7 | [Access Control Matrix](07-security-compliance/07-access-control-matrix.md) | Complete |
| 8 | [Encryption Standards Document](07-security-compliance/08-encryption-standards-document.md) | Complete |
| 9 | [Vulnerability Management Procedure](07-security-compliance/09-vulnerability-management-procedure.md) | Complete |
| 10 | [Business Continuity Plan](07-security-compliance/10-business-continuity-plan.md) | Complete |
| 11 | [WCAG Accessibility Compliance Report](07-security-compliance/11-wcag-accessibility-compliance-report.md) | Complete |
| 12 | [AI Model Risk Assessment](07-security-compliance/12-ai-model-risk-assessment.md) | N/A for the product; AI-assisted development assessed |
| 13 | [AI Model Validation Report](07-security-compliance/13-ai-model-validation-report.md) | N/A (no model) + template |
| 14 | [Third-Party Vendor Assessment Document](07-security-compliance/14-third-party-vendor-assessment.md) | Complete (2 vendors pending) |

## Key open items surfaced by this documentation
1. Production prerequisites (Step 18d): persist Data Protection keys, first-admin set-up, security headers, rate limiting, file storage.
2. Before go-live: penetration test, load test on target hardware, screen-reader and zoom checks, UAT, DPIA approval.
3. Decisions: production SQL Server edition, retention periods, governing data-protection law, AWS access, HR / tracker API details.
4. Quick wins: self-host the Inter font; enable GitHub 2FA / branch protection; confirm the repository visibility.
