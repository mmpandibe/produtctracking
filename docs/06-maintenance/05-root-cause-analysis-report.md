# Root Cause Analysis (RCA) Report

| | |
|---|---|
| Document ID | NPRO-RCA-001 |
| Version | 1.0 · 27 Nov 2026 |
| Subject | PRB-001 — accessibility CSS rule changed button layouts across the app (defects D-09, D-10) |
| Severity | Medium (development; no production impact) |

## 1. Summary
A global CSS rule added for WCAG 2.5.8 (minimum 24 × 24 px targets) made all buttons whose only element child is an icon display as
a centred grid. It (a) overrode responsive `lg:hidden` classes, showing the phone menu's close button on desktop (D-09, 26 Nov),
and (b) matched buttons with an icon **and plain text**, stacking the icon above the text, e.g. "Create product" (D-10, 27 Nov).

## 2. Timeline
| When | Event |
|---|---|
| 26 Nov | Rule `:is(button, a):has(> app-icon:only-child)` added during the WCAG pass |
| 26 Nov | D-09 seen in a screenshot; fixed by excluding classes containing "hidden" |
| 27 Nov | D-10 seen while checking the new product grid; fixed by limiting the rule to `[aria-label]` icon-only controls |

## 3. Root cause (5 whys)
1. Why did text buttons stack? The rule set `display: inline-grid` on them.
2. Why did the rule match? `:only-child` ignores text nodes, so "icon + text" looks like "icon only" to CSS.
3. Why wasn't it caught at once? The automated checks (unit tests, axe) don't check visual layout; the first fix was verified on the
   screens where the first symptom appeared only.
4. Why a global rule? It fixed many small buttons at once.
5. Why no safety net? No visual regression tests exist.

**Root cause:** a broad global selector introduced without a visual regression check across screens.

## 4. Corrective actions
| Action | Owner | Status |
|---|---|---|
| Restrict the rule to icon-only controls with `aria-label` | Dev | Done (`1cd0b22`) |
| Add a screenshot comparison (Playwright) of key screens to the regression suite | Dev / QA | Open |
| Code review checklist: "global CSS change → check all screens at 3 widths" | Dev | Done (NPRO-CRC-001) |

## 5. Template for future RCAs
Summary · impact · timeline · root cause (5 whys / fishbone) · contributing factors · corrective and preventive actions · owners ·
verification.
