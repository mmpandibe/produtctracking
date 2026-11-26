# Problem Management Report

| | |
|---|---|
| Document ID | NPRO-PRB-001 |
| Version | 1.0 · 27 Nov 2026 |

## 1. Purpose
Find and remove the underlying causes of incidents and recurring defects; keep a known-error list with workarounds.

## 2. Process
Problem raised (after a P1 / P2 incident, repeated incidents or trend) → investigate (RCA) → known error + workaround → permanent
fix via CR / patch → verify → close.

## 3. Problem log

| ID | Problem | Source | Root cause | Workaround | Permanent fix | Status |
|---|---|---|---|---|---|---|
| PRB-001 | Global CSS rules caused layout regressions on unrelated screens | Defects D-09, D-10 | Broad selector without visual regression testing | — | Narrowed selector; visual regression snapshots planned | Fixed / action open |
| PRB-002 | Sessions lost after an IIS app-pool recycle (expected in production) | Design review | Data Protection keys not persisted | Users sign in again | Persist key ring (18d) | Known error |
| PRB-003 | Attachments not visible to other users | Design (Phase A) | File bytes stored in the uploader's browser | Share files outside nPro | Server file storage (18d) | Known error |
| PRB-004 | Timed rules stop when IIS idles the site | Design | IIS app-pool idle shutdown | Keep a user session open | AlwaysRunning + Preload (deployment config) | Known error |

## 4. Known-error database (for the service desk)

| Symptom | Known error | Workaround |
|---|---|---|
| "Everyone was signed out" after maintenance | PRB-002 | Sign in again |
| "I can't open the file my colleague attached" | PRB-003 | Ask the colleague to send it until 18d |
| "Not saved" red banner | Server refused or conflict | Retry; the latest data is shown; check permissions |
