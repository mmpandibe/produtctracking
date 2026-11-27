# Third-Party Component Register

| | |
|---|---|
| Document ID | NPRO-TPC-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Vulnerability check | `npm audit`: 0 vulnerabilities · `dotnet list package --vulnerable --include-transitive`: none (27 Nov 2026) |

## 1. Runtime components (shipped)

| Component | Version | Licence | Purpose |
|---|---|---|---|
| @angular/core, common, compiler, forms, platform-browser, router | 22.3.0 | MIT | UI framework |
| @angular/cdk | 22.3.0 | MIT | Drag-and-drop, focus trap |
| rxjs | 7.8.2 | Apache-2.0 | Router events |
| tslib | 2.9.1 | 0BSD | TypeScript helpers |
| lucide | 1.80.0 | ISC | Icons |
| Microsoft.AspNetCore.* (shared framework) | .NET 10 | MIT | Web API |
| Microsoft.EntityFrameworkCore.SqlServer | 10.0.15 | MIT | Data access |
| Microsoft.AspNetCore.Identity.EntityFrameworkCore | 10.0.15 | MIT | Sign-in accounts |
| @fontsource-variable/inter (Inter font, bundled since 18d) | 5.3.0 | SIL OFL 1.1 | Typography, served from our own site |

## 2. Build / test components (not shipped)

| Component | Version | Licence | Purpose |
|---|---|---|---|
| @angular/cli, @angular/build, @angular/compiler-cli | 22.3.0 | MIT | Build |
| typescript | 6.0.3 | Apache-2.0 | Compiler |
| tailwindcss, @tailwindcss/postcss, postcss | 4.3.5 / 8.5.33 | MIT | CSS build |
| vitest | 5.1.2 | MIT | Unit tests |
| jsdom | 31.0.1 | MIT | Test DOM |
| prettier | 3.10.1 | MIT | Formatting |
| axe-core | 4.14.1 | MPL-2.0 | Accessibility scan |
| Microsoft.EntityFrameworkCore.Design, dotnet-ef | 10.0.15 | MIT | Migrations |
| Microsoft.EntityFrameworkCore.Sqlite | 10.0.15 | MIT | Test database |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.15 | MIT | API tests |
| xunit / xunit.runner.visualstudio / Microsoft.NET.Test.Sdk / coverlet.collector | 2.9.3 / 3.1.4 / 17.14.1 / 6.0.4 | Apache-2.0 / MIT | Test framework |

## 3. Platform software

| Product | Version | Licence |
|---|---|---|
| .NET SDK / runtime | 10.0.404 / 10.0 (LTS to Nov 2028) | MIT |
| ASP.NET Core Hosting Bundle (IIS) | 10.0 | MIT |
| Microsoft SQL Server | 2022 (Express dev; Standard / RDS prod) | Commercial (Express free) |
| Windows Server / IIS | 2022 / 10 | Commercial |

## 4. Licence obligations
MIT / Apache / ISC / 0BSD: keep copyright notices (bundled in the build's third-party licence output). MPL-2.0 (axe-core) is a
development tool only. SIL OFL (Inter): free to use and self-host.

## 5. Maintenance
Review monthly: `npm outdated`, `npm audit`, `dotnet list package --outdated --vulnerable`; patch per the Patch Management
Document.
