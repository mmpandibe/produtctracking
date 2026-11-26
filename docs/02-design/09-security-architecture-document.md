# Security Architecture Document

| | |
|---|---|
| Document ID | NPRO-SEC-ARCH-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Reference | OWASP ASVS 4.0 (target Level 2), OWASP Top 10 2021 |

## 1. Security objectives
Confidentiality of tickets, client data and employee data (attendance, leave, productivity); integrity of records and history;
availability during business hours; accountability (who changed what).

## 2. Controls by layer

| Layer | Control | Implementation |
|---|---|---|
| Transport | TLS 1.2+ only, HSTS | IIS / load balancer binding (production config, 18d) |
| Authentication | Password sign-in, ASP.NET Core Identity | PBKDF2 password hashing (Identity v3), min 10 chars + upper / lower / digit, lockout 5 tries / 5 min, same error for unknown user and wrong password |
| Session | Cookie `npro.auth` | HttpOnly, SameSite=Strict, Secure on HTTPS, 8 h sliding expiry; API answers 401 / 403 (no redirects) |
| CSRF | Antiforgery | `XSRF-TOKEN` cookie + `X-XSRF-TOKEN` header required on every write; token bound to the identity |
| Authorisation | Role capabilities + data scope | `AccessScope.For(me, org)` on every read; `/api/sync` authorises each changed record (Access Control Matrix); batches all-or-nothing |
| Input handling | Typed deserialisation, EF Core parameterised queries | No dynamic SQL; ids checked against body; unknown collections refused |
| Output | Angular template escaping | No `innerHTML` with user content (icons are generated SVG) |
| Impersonation guard | Records must be authored as the signed-in person | comments / activities / work logs / timers checked; `automation` actor only by the server engine |
| Secrets | Not in source (except a development-only demo password) | Production: environment variables / IIS config / AWS Secrets Manager (when available) |
| Logging | ASP.NET Core logs; no passwords or tokens logged | Health endpoint reveals only up / down |
| Dependencies | npm audit, `dotnet list package --vulnerable` | 0 known vulnerabilities on 27 Nov 2026 |
| Demo features | "Sign in as" switcher and demo seed | Off unless `Features:DemoSwitcher` / `Seed:DemoPassword` are set (development only) |

## 3. Threat model (STRIDE summary)

| Threat | Example | Mitigation |
|---|---|---|
| Spoofing | Stolen password | Lockout, strong passwords; SSO + MFA planned |
| Tampering | Client edits a ticket via crafted sync call | Server-side per-record authorisation; tested (SyncTests) |
| Repudiation | Denying a change | Activity history with user and time; automation runs logged |
| Information disclosure | Client user requests another client's ticket | Scope filter on every endpoint; 403 on direct key access; tested |
| Denial of service | Login brute force, large payloads | Lockout; IIS request limits; rate limiting recommended |
| Elevation of privilege | Developer renames a product / changes rules | Capability checks per collection; tested |

## 4. Known gaps and actions
| Gap | Action | Target |
|---|---|---|
| Data Protection keys not persisted | Persist key ring (file share with ACL or DB) in production | 18d |
| No MFA / SSO | OpenID Connect with Entra ID / Google | Post go-live |
| No rate limiting | ASP.NET Core rate limiter on `/auth/login` and `/sync` | 18d |
| Security headers | CSP, X-Content-Type-Options, Referrer-Policy, frame-ancestors via IIS / middleware | 18d |
| Pen test not done | External test before go-live | Week 3 |
| Third-party font CDN | Self-host Inter | 18d |
