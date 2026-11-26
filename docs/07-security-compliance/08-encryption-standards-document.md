# Encryption Standards Document

| | |
|---|---|
| Document ID | NPRO-ENC-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

| Area | Standard | nPro implementation | Status |
|---|---|---|---|
| Data in transit — browser ↔ server | TLS 1.2 minimum, TLS 1.3 preferred; strong ciphers (AES-GCM, ECDHE); HSTS max-age ≥ 1 year | ALB / IIS binding with ACM or CA certificate; HTTP → HTTPS redirect; HSTS header | ⏳ configure at deployment |
| Data in transit — server ↔ SQL Server | TLS (`Encrypt=True`) with a trusted certificate | Production connection string `Encrypt=True;TrustServerCertificate=False` (dev uses `TrustServerCertificate=True` locally only) | ⏳ |
| Data in transit — server ↔ external APIs | TLS 1.2+; certificate validation on | HttpClient defaults | ⏳ with 18d adapters |
| Passwords | Salted adaptive hash | ASP.NET Core Identity v3 hasher: PBKDF2 with HMAC-SHA512, 100 000 iterations, 128-bit salt | ✅ |
| Session cookies | Authenticated encryption | ASP.NET Core Data Protection (AES-256-CBC + HMACSHA256 by default); key ring must be persisted and protected (DPAPI / certificate) | ⏳ persistence in 18d |
| XSRF tokens | Data Protection | Antiforgery service | ✅ |
| Data at rest — database | AES-256 | SQL Server TDE (Standard / Enterprise 2019+) **or** EBS / RDS storage encryption (KMS) | ⏳ (Express has no TDE) |
| Data at rest — backups | AES-256 | `BACKUP … WITH ENCRYPTION` (certificate) or encrypted S3 bucket (SSE-KMS) | ⏳ |
| Data at rest — attachments | AES-256 | Encrypted volume; S3 SSE-KMS later | ⏳ 18d |
| Secrets | Encrypted secret store | Environment / IIS config protected by ACL; AWS Secrets Manager when available | ⏳ |
| Key management | Keys rotated yearly or on suspicion; access logged | Data Protection auto-rotation (90 days); KMS rotation | ⏳ |

Prohibited: SSL 3 / TLS 1.0 / 1.1, MD5 / SHA-1 for security purposes, custom cryptography, secrets in source code.
