# Release Management Document

| | |
|---|---|
| Document ID | NPRO-REL-MGMT-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Release types

| Type | Version change | Content | Cadence | Approval |
|---|---|---|---|---|
| Major | X.0.0 | Breaking changes, big features, data model changes needing planning | As planned | Product owner + IT + security |
| Minor | 1.X.0 | Features, non-breaking migrations | Every 2–4 weeks | Product owner |
| Patch | 1.0.X | Bug and security fixes | As needed | Product owner (emergency: delivery head) |

Semantic versioning; Git tag `vX.Y.Z` on the released commit.

## 2. Release process
1. **Plan**: scope from approved user stories / CRs; release ticket created.
2. **Freeze**: feature freeze 3 days before; only fixes.
3. **Verify**: automated suites, a11y scan, regression smoke, migration script review, security scan for dependency updates.
4. **Approve**: Production Readiness Checklist complete; go / no-go meeting.
5. **Deploy**: Deployment Plan; Rollback Plan ready.
6. **Confirm**: smoke test; Deployment Sign-off; release notes published.
7. **Review**: issues in the first week feed the next release.

## 3. Roles
Release manager (project manager): runs the process. Developers: package, migrations, fixes. QA: verification. IT: deployment and
infrastructure. Product owner: approval and communication.

## 4. Release calendar
Kept in nPro (product "nPro" roadmap) after go-live; blackout periods agreed with the business (e.g. month-end reporting).

## 5. Artefacts per release
Tag, release notes, package zip with checksum, migration script, test evidence, readiness checklist, sign-off.
