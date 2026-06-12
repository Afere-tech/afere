# Afere Product Strategy — Evaluation Examples

These are realistic feature evaluations using actual Afere domain scenarios. Use them as calibration references when applying the evaluation framework.

---

## Example 1: Calculation History

---

## Feature

Calculation History

## Problem Solved

Neurosurgeons and billing professionals frequently repeat similar procedures across different patients or billing cycles. Currently, each session in Afere starts from scratch. There is no way to review past valuations, compare honoraria across time, or audit a previous calculation without manually recreating it. This is a daily friction point for active users who bill regularly.

## Benefits

- Users can retrieve and review previous calculations without re-entering data.
- Enables auditing and documentation for insurance disputes or hospital negotiations.
- Creates session continuity — users have a reason to return to Afere rather than switching to a spreadsheet.
- Provides the data foundation for future features: statistics, trends, favorites.

## Risks

- Requires persistent storage. Before v3.x auth, history is local/session-scoped, limiting cross-device use.
- If poorly designed, a long history list becomes noise. Requires good UX around search and filtering.
- Users may expect server-side sync, leading to expectation mismatch before v3.x.

## Evaluation

| Dimension          | Score |
|--------------------|-------|
| User Value         | 5/5   |
| Retention          | 5/5   |
| Monetization       | 4/5   |
| Acquisition        | 2/5   |
| Alignment          | 5/5   |
| **Total**          | 21/25 |
| Complexity         | Medium |

## Recommendation

**Implement Now**

## Justification

This is a core v2.2.x deliverable. It solves an observed, recurring pain point and directly drives return behavior — the single most important metric at this stage of the product. A local-first implementation (no auth required) is feasible at Medium complexity. The monetization leverage comes from gating history depth or export in a future premium tier.

---

## Example 2: Patient Appointment Scheduling

---

## Feature

Patient Appointment Scheduling

## Problem Solved

Neurosurgeons manage busy surgical schedules. A user suggested that Afere could help coordinate procedure scheduling alongside billing, reducing tool-switching between systems.

## Benefits

- Theoretical reduction in tool fragmentation for solo practitioners.
- Could capture more daily time-on-product if surgeons manage their schedule in Afere.

## Risks

- Scheduling is a separate product category entirely. It requires calendar integration, notifications, conflict resolution, patient data storage, and likely LGPD/HIPAA-adjacent compliance obligations.
- Pulls engineering and design resources away from the core valuation engine.
- Positions Afere as an EMR-adjacent tool, attracting different competitors and different regulatory scrutiny.
- Confuses the product's value proposition for both users and investors.

## Evaluation

| Dimension          | Score |
|--------------------|-------|
| User Value         | 2/5   |
| Retention          | 2/5   |
| Monetization       | 1/5   |
| Acquisition        | 1/5   |
| Alignment          | 1/5   |
| **Total**          | 7/25  |
| Complexity         | High  |

## Recommendation

**Reject**

## Justification

This violates Afere's core product identity. Scheduling is a fundamentally different domain with its own compliance surface, UX patterns, and competitive landscape. A score of 7/25 with High complexity makes this an easy rejection. The feature request likely reflects a user wanting to reduce app-switching, which is better solved by deepening Afere's core valuation workflow than by expanding into an adjacent category. Do not revisit unless the product strategy fundamentally changes.

---

## Example 3: Shareable PDF Report

---

## Feature

Shareable PDF Report (Branded Honorarium Export)

## Problem Solved

After completing a CBHPM valuation in Afere, neurosurgeons need to present the result to hospital administrators, health insurance operators, or billing departments. Currently, they screenshot the result or manually transcribe it into a Word document. A professional PDF export would replace this workaround.

## Benefits

- Dramatically increases the perceived professionalism of Afere's output.
- The PDF carries Afere's brand into hospital and insurance workflows — every share is an acquisition touchpoint.
- A high-quality report export is a clear premium feature: gate the branded export (or remove watermarks) behind a subscription.
- Satisfies a real, frequently observed workflow: neurosurgeons presenting billing to third parties.

## Risks

- PDF generation on the backend adds infrastructure (likely a headless renderer or Go PDF library).
- Report design requires careful attention to Brazilian medical billing conventions (CBHPM codes, port values, surgical team breakdown).
- If the free tier's PDF has a watermark, some users will perceive it as aggressive. Calibrate carefully.

## Evaluation

| Dimension          | Score |
|--------------------|-------|
| User Value         | 5/5   |
| Retention          | 3/5   |
| Monetization       | 5/5   |
| Acquisition        | 5/5   |
| Alignment          | 5/5   |
| **Total**          | 23/25 |
| Complexity         | Medium |

## Recommendation

**Implement Now**

## Justification

This is a tier-1 feature for Afere's monetization and acquisition strategy. Every PDF exported is a branded artifact that travels into hospital and insurance ecosystems — that is earned acquisition with zero marginal cost. The monetization leverage (watermarked free vs. clean premium) is direct and intuitive. It is a v2.3.x milestone item and should be treated as the anchor feature of that release. Begin scoping the PDF layout against CBHPM report conventions immediately.

---

## Example 4: AI-Powered Procedure Suggestion

---

## Feature

AI-Powered Procedure Suggestion

## Problem Solved

During CBHPM code selection, neurosurgeons must navigate hundreds of codes to find the correct procedure. An AI model trained on neurosurgical procedure descriptions could suggest the most likely CBHPM codes based on a natural-language description of the surgery performed.

## Benefits

- Reduces the time to build a complete calculation from scratch.
- Lowers the expertise barrier: less experienced billing staff could use Afere without deep CBHPM knowledge.
- Differentiating feature that no current competitor in the Brazilian neurosurgery billing space offers.

## Risks

- Requires high-quality training data aligned with CBHPM + SBN coding conventions.
- A wrong suggestion could result in underbilling or overbilling — a compliance risk.
- Without sufficient usage data from Afere's own user base, suggestions will be based on generic medical text, not real neurosurgical billing patterns.
- AI inference costs money at scale; pricing model must account for it.
- Premature investment before usage volume makes the training data too sparse.

## Evaluation

| Dimension          | Score |
|--------------------|-------|
| User Value         | 4/5   |
| Retention          | 4/5   |
| Monetization       | 4/5   |
| Acquisition        | 4/5   |
| Alignment          | 5/5   |
| **Total**          | 21/25 |
| Complexity         | High  |

## Recommendation

**Implement Later**

## Justification

The scores are strong, but the timing is wrong. Afere does not yet have the usage volume to generate the domain-specific training signal needed for trustworthy suggestions. A premature AI feature that suggests incorrect CBHPM codes would damage trust faster than it builds it. This belongs in the v3.x era or as a deliberate v2.3.x research spike after usage data from Saved Calculations and History becomes available. Log it as a high-priority backlog item and revisit after 6 months of production usage data.

---

## Example 5: Favorite Procedures

---

## Feature

Favorite Procedures (Pinned CBHPM Codes)

## Problem Solved

Most neurosurgeons have a core set of 10–20 procedures they perform repeatedly. Currently, every calculation requires navigating the full CBHPM code list. Pinning frequently used codes would reduce repetitive navigation and make the calculation flow significantly faster for established users.

## Benefits

- Reduces time-to-calculation for experienced users.
- Creates a personalized layer in Afere that increases switching cost — a user's favorites are a form of data lock-in.
- Directly feeds into future features: statistics per favorite, bulk calculation over a set of pinned procedures.

## Risks

- Low complexity but must be designed carefully: favorites should be per-user once v3.x auth lands. Before that, local storage is acceptable.
- Risk of over-engineering: a simple pinning UI is enough. Do not build a full "procedure library" management system at this stage.

## Evaluation

| Dimension          | Score |
|--------------------|-------|
| User Value         | 4/5   |
| Retention          | 4/5   |
| Monetization       | 3/5   |
| Acquisition        | 1/5   |
| Alignment          | 5/5   |
| **Total**          | 17/25 |
| Complexity         | Low   |

## Recommendation

**Implement Later**

## Justification

Strong alignment and meaningful retention value, but the 17/25 score and Low complexity put it just below the Implement Now threshold. This is a solid v2.3.x item — it follows naturally after Calculation History gives users enough context to know which procedures deserve a favorite. Implementing before History would be putting the cart before the horse. Scope it as a simple local pin with a maximum of 20 favorites; no management UI needed at this stage.
