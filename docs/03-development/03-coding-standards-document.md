# Coding Standards Document

| | |
|---|---|
| Document ID | NPRO-CS-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. TypeScript / Angular

| Rule | Example / note |
|---|---|
| Standalone components, `ChangeDetectionStrategy.OnPush`, signals (`signal`, `computed`, `effect`) | No NgModules, no zone-based change detection |
| Control flow `@if / @for / @switch / @let` | `@for` always has `track` |
| Strict typing; no `any` except `$any(...)` for DOM events in templates | `noImplicitAny`, strict null checks |
| Immutable state updates in `DataStore` | `this.state.update((s) => ({ ...s, issues: s.issues.map(...) }))` — required by the sync diff |
| Inputs / outputs with `input()` / `output()` | `readonly open = input(false)` |
| `<select [value]>` doesn't work with `@for` options | Use `[selected]` on each option |
| Names | Components `PascalCase` classes, files `kebab-case.ts`; signals as nouns (`query`), methods as verbs (`setProduct`) |
| Formatting | Prettier (`.prettierrc`), 2 spaces, single quotes, print width 140 |
| Comments | `/** … */` on exported functions and non-obvious logic; explain *why* |

## 2. C# / .NET

| Rule | Example / note |
|---|---|
| Nullable reference types and implicit usings on | All projects |
| File-scoped namespaces, primary constructors where helpful | `public sealed class RuleEngine(NproDbContext db, …)` |
| Async all the way (`…Async`), pass `CancellationToken` in background work | |
| Minimal APIs grouped by area (`MapGroup`) | `Endpoints.cs`, `Sync.cs` |
| Problem details for errors | `Results.Problem(detail, statusCode: 403)` |
| EF Core: `AsNoTracking()` for reads; transactions through `CreateExecutionStrategy()` | Retry-on-failure is enabled |
| No dynamic SQL; `ExecuteUpdateAsync` for atomic counters | `NextKeyAsync` |
| String constants for roles / capabilities | `Roles.Admin`, `Capabilities.Products` |
| Names | `PascalCase` types / methods, `camelCase` locals, `_` not used; tests named as sentences (`Client_users_can_comment_but_not_edit…`) |

## 3. Styling (Tailwind)
Utility classes in templates; shared component classes in `src/styles.css` (`@layer components`); no inline `style=""` except
dynamic colours / positions; respect the accessibility rules in the Development Standards.

## 4. Tests
Angular: Vitest in `src/app/app.spec.ts`, `describe` per feature, `localStorage.clear()` in `beforeEach`.
Server: xUnit, one class per area, `IClassFixture<ApiFactory>`, `XsrfHandler` for writes.

## 5. Forbidden
Secrets in code; `console.log` left in committed code (use `console.error` only for real errors); commented-out code; disabling
tests; `innerHTML` with user data; synchronous blocking calls (`.Result`, `.Wait()`) in the API.
