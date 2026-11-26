# AI Model Risk Assessment

| | |
|---|---|
| Document ID | NPRO-AIRA-001 |
| Version | 1.0 · 27 Nov 2026 |
| Conclusion | **nPro contains no AI or machine-learning model.** Product AI risk: not applicable. Development-process AI use assessed below. |

## 1. AI in the product
| Question | Answer |
|---|---|
| Does nPro use AI / ML models (prediction, classification, generative AI, recommendations)? | No |
| Do automation rules use AI? | No — deterministic "when / if / then" rules configured by people |
| Does productivity data feed automated decisions about people? | No — shown to people and managers only |
| Are third-party AI services called? | No |

If an AI feature is proposed (e.g. ticket summarisation, effort estimation, triage), this assessment must be completed **before**
development, covering: purpose and users; data used (no personal / client data to external models without approval); EU AI Act
classification (employment-related uses may be high-risk); bias and fairness; transparency to users; human oversight; accuracy
monitoring; security (prompt injection, data leakage); vendor terms.

## 2. AI used in development (AI-assisted coding)
nPro's code and documentation were produced with an AI coding assistant under the direction of the product owner.

| Risk | Controls in place | Residual |
|---|---|---|
| Incorrect or insecure code | Automated tests (79 + 20), server-side authorisation tests, accessibility scan, dependency scans, code review checklist; findings fixed (Defect report) | Low–medium (independent pen test pending) |
| Licence contamination (copied code) | Code written for this project; dependencies only from npm / NuGet with known licences (Third-Party Component Register) | Low |
| Confidential data shared with the AI service | Only this project's code and demo data were used; no production or client data | Low |
| Over-reliance / knowledge gaps | Documentation set, HANDOFF, standards; human review and approval of each step | Medium (key-person risk R-12) |
| Inaccurate documentation | Reports state only measured results; open items marked as such | Low |

## 3. Review
Re-assess when any AI capability is added to the product or the development tooling changes.
