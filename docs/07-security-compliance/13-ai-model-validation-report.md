# AI Model Validation Report

| | |
|---|---|
| Document ID | NPRO-AIVR-001 |
| Version | 1.0 · 27 Nov 2026 |
| Status | **Not applicable** — nPro has no AI or machine-learning model to validate (see AI Model Risk Assessment NPRO-AIRA-001) |

## 1. Statement
No model has been trained, fine-tuned, embedded or called by nPro. Automation rules and calculations (SLA clocks, reports, Gantt,
productivity comparisons) are deterministic and validated by conventional tests (Test Execution Report).

## 2. Template for future AI features
To be completed before any AI feature is released:

| Section | Content |
|---|---|
| Model and version | Provider, model ID, version, hosting |
| Intended use and limits | Users, decisions supported, out-of-scope uses |
| Data | Training / grounding data, personal data handling, data residency |
| Evaluation data set | Representative, labelled, includes edge cases and under-represented groups |
| Metrics and thresholds | Accuracy / precision / recall or task-specific measures; acceptance thresholds |
| Fairness | Performance across groups (e.g. teams, vendor vs internal staff); disparity limits |
| Robustness and security | Prompt injection, adversarial inputs, data leakage tests |
| Explainability and transparency | What users see; labelling of AI output |
| Human oversight | Review / override points; no automated decisions about people without review |
| Monitoring | Drift, error reports, periodic re-validation |
| Results and sign-off | Measured results vs thresholds; approvers (product owner, DPO, security) |
