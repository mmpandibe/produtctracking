# Security Testing Report

| | |
|---|---|
| Document ID | NPRO-TST-SEC-001 |
| Version | 1.0 · 27 Nov 2026 |
| Scope | Development build (commit `1cd0b22`); automated and manual checks performed by the development team |
| Not yet done | Independent penetration test, DAST scan (OWASP ZAP) in a Test environment |

## 1. Automated security tests (all passing)

| Area | Test | Result |
|---|---|---|
| Authentication required | `Data_needs_a_signed_in_person_and_wrong_passwords_are_refused` (401 without session; same error for unknown user and wrong password) | Pass |
| Session end | `Me_returns_role_capabilities_and_scope…` (logout → 401) | Pass |
| CSRF | `Writes_without_the_xsrf_token_are_refused` (400) | Pass |
| Horizontal access | `Client_users_see_only_their_own_and_their_company_tickets` (403 on another client's ticket) | Pass |
| Scope by role | `Division_heads_see_their_division_products…` | Pass |
| Write authorisation | `Developer_creates_a_ticket_but_cannot_rename_a_product`; `Client_users_can_comment_but_not_edit_or_impersonate` | Pass |
| Atomicity | `A_refused_change_rolls_back_the_whole_batch` | Pass |
| Privilege | `Admin_adds_a_person_and_sets_their_password` (non-admin 403, weak password 400) | Pass |
| Integrity | `Two_people_guessing_the_same_ticket_key_get_different_numbers` | Pass |

## 2. Manual checks (development)

| Check | Result |
|---|---|
| Wrong password message reveals nothing | Pass ("Wrong email, employee ID or password") |
| Demo switcher off when `Features:DemoSwitcher` is false | Pass (endpoint returns 404) |
| Unknown `/api` path returns 404 (not the SPA) | Pass |
| Auth cookie HttpOnly / SameSite=Strict | Configured in code; browser verification open |
| Lockout after 5 failures | Configured (Identity options); manual test open |

## 3. Findings

| ID | Finding | Severity | Recommendation |
|---|---|---|---|
| S-01 | ASP.NET Data Protection keys not persisted → sessions lost on app-pool recycle; multi-node impossible | Medium | ✅ Fixed in 18d: `DataProtection:KeysPath`, DPAPI-protected |
| S-02 | No rate limiting on login / sync | Medium | ✅ Fixed in 18d: login 10/min per address, writes 300/min per person (tested: 429) |
| S-03 | Security headers not set (CSP, X-Content-Type-Options, Referrer-Policy, frame-ancestors, HSTS) | Medium | ✅ Fixed in 18d: CSP (self only), nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS outside Development |
| S-04 | No MFA / SSO | Medium | OIDC SSO with MFA — post go-live |
| S-05 | Google Fonts CDN (third-party request, IP disclosure) | Low | ✅ Fixed in 18d: Inter bundled (@fontsource-variable/inter) |
| S-06 | Development demo password committed (dev only) | Low | Keep empty in production; optional user-secrets |
| S-07 | No FK constraints (integrity relies on the API) | Low | Add FKs in a migration |

No critical or high findings from development testing. Independent testing may find more.

## 4. Next steps
OWASP ZAP baseline + authenticated scan in the Test environment; ASVS Level 2 checklist review; external penetration test; fix
critical / high before go-live; append results here.
