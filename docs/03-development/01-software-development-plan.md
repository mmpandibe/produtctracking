# Software Development Plan

| | |
|---|---|
| Document ID | NPRO-SDP-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Lifecycle model
Iterative and incremental: one capability ("step") per iteration, each ending in a working, verified increment and an updated
`ROADMAP.md` / `HANDOFF.md`. Phase A delivered the complete UI on browser storage (Steps 1–17); Phase B adds the backend (18a–18d).

## 2. Iteration definition of done
1. Feature works in the browser at desktop (1366 px) and phone (375 / 320 px) widths; no horizontal or inner scrolling.
2. `npx.cmd ng build` and `npx.cmd ng test --watch=false` pass; for backend changes `dotnet test server` passes.
3. Accessibility scan (`npm.cmd run a11y`, `a11y:mobile`) reports 0 violations.
4. Code reviewed against the Code Review Checklist.
5. Docs updated (HANDOFF, ROADMAP, README, API spec where affected).
6. Committed to `main` with a descriptive message and pushed (on request of the product owner).

## 3. Team and responsibilities
| Role | Responsibility |
|---|---|
| Product owner | Priorities, acceptance, step approval |
| Developer(s) | Design, code, unit / integration tests, docs |
| QA | Test plan, scenarios, regression, UAT support |
| IT / infrastructure | Environments, deployment, backups |
| Security / DPO | Reviews, DPIA, pen-test coordination |

Development so far used an AI coding assistant under the product owner's direction; all changes are reviewed, tested and
committed through the same process (see AI Model Risk Assessment for the related controls).

## 4. Tools
| Purpose | Tool |
|---|---|
| Source control | Git, GitHub (`mmpandibe/produtctracking`, branch `main`) |
| UI build / test | Angular CLI 22, Vitest, axe-core scan (`scripts/a11y-scan.cjs`) |
| API build / test | .NET SDK 10.0.404 (pinned in `global.json`), xUnit, `dotnet-ef` 10 |
| Database | SQL Server Express (dev), SSMS optional |
| Editor | Any (VS Code / Visual Studio / Rider); `.editorconfig` and Prettier settings in the repo |

## 5. Estimation and tracking
Steps are tracked in `ROADMAP.md`; tasks in nPro itself once deployed.

## 6. Quality assurance
Automated tests on every step; accessibility scan; code review; test strategy and plan (Section 4 documents).

## 7. Remaining development (see Project Plan)
18d — file storage abstraction, server-side HR / tracker adapters, IIS deployment kit, production configuration, first-admin
set-up, rate limiting and security headers; then hardening fixes from security / load / UAT testing.
