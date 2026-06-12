# Calculation Auditor — Validation Checklist

Run this checklist on every change that touches valuation logic. Each item must be explicitly confirmed or flagged before the audit can produce a recommendation.

A checklist item marked **BLOCKING** means the audit cannot proceed until it is resolved. A **WARNING** item must be documented in the Risks section but does not halt the audit.

---

## Phase 1: Scope Identification

Before opening any code, determine what the change affects.

- [ ] Identify which CBHPM items are involved (4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, etc.)
- [ ] Identify whether porte determination is touched
- [ ] Identify whether auxiliary remuneration is touched
- [ ] Identify whether access route grouping logic is touched
- [ ] Identify whether pediatric adjustment logic is touched
- [ ] Identify whether any numeric constant (percentage, multiplier, threshold) is added or changed
- [ ] List all files modified that contain valuation logic

---

## Phase 2: Documentation Search

For each rule identified in Phase 1:

- [ ] **[BLOCKING]** Locate the rule in `docs/domain-model.md` or `docs/valuation-validation.md`
- [ ] **[BLOCKING]** Locate the rule in the CBHPM (cite edition, chapter, item, and paragraph)
- [ ] Cross-reference with `PRD.md` if the rule was introduced by a product requirement
- [ ] If SBN-specific: locate the rule in the SBN tabela or circular
- [ ] Confirm that no rule contradicts another referenced rule

If any BLOCKING item cannot be satisfied:

> **HALT. Do not proceed. Request clarification from the domain owner before continuing.**

---

## Phase 3: Porte Validation

- [ ] Confirm every CBHPM code involved has a porte value assigned in the database or reference table
- [ ] Confirm the porte value matches the CBHPM 5ª Edição tabela (or the edition in use)
- [ ] Confirm porte is sourced from a lookup, not hardcoded in the formula
- [ ] **[WARNING]** If a procedure has no explicit porte, confirm the fallback logic is documented and approved

---

## Phase 4: Procedure Ordering Validation (Item 4.1 / 4.2)

- [ ] Confirm the ordering algorithm: descending by porte, primary = highest
- [ ] Confirm tie-breaking behavior when two procedures share the same porte (documented or user-selectable?)
- [ ] Confirm the percentage applied to the 2nd procedure (cite CBHPM Item 4.1 §2 exactly)
- [ ] Confirm the percentage applied to the 3rd and subsequent procedures (cite CBHPM Item 4.1 §2 — note: percentage may differ from 2nd)
- [ ] **[BLOCKING]** If different access routes are involved: confirm each access route group is ordered independently
- [ ] Confirm no procedure appears in more than one access route group

---

## Phase 5: Same Access Route Validation (Item 4.1)

- [ ] Confirm that procedures in the same group share the same access route identifier
- [ ] Confirm that the access route identifier is surgeon-supplied, not inferred from the CBHPM code
- [ ] Confirm that percentage reductions are applied to each subsequent procedure's porte, not to the cumulative total
- [ ] Verify the formula: `honorario = Σ (porte_i × UC × reduction_factor_i)`

---

## Phase 6: Different Access Routes Validation (Item 4.2)

- [ ] Confirm that each access route group is evaluated independently using Item 4.1 rules
- [ ] Confirm the final surgeon honorarium is the sum of all access route group totals
- [ ] Confirm that there is no inter-group reduction (Item 4.2 groups are additive, not reduced relative to each other)
- [ ] **[WARNING]** Document any edge case where a procedure's access route is ambiguous

---

## Phase 7: Bilateral Procedures Validation (Item 4.3)

- [ ] Confirm the bilateral multiplier value (cite CBHPM Item 4.3 exactly)
- [ ] Confirm whether the bilateral multiplier applies to the procedure's porte or to its already-reduced honorarium (if combined with Item 4.1)
- [ ] Confirm the interaction rule: bilateral + same access route — which takes precedence?
- [ ] Confirm the interaction rule: bilateral + different access routes — are the two sides treated as separate groups?

---

## Phase 8: Integrated Procedures Validation (Item 4.5)

- [ ] Confirm that the "integrated" flag is sourced from the CBHPM table, not inferred by the system
- [ ] Confirm that integrated procedures performed together are not independently valued
- [ ] Confirm what value (if any) is assigned to the secondary integrated procedure
- [ ] **[BLOCKING]** If the integrated flag is missing from the database for a procedure, halt and request data correction

---

## Phase 9: Pediatric Adjustment Validation (Items 4.6 / 4.7 / 4.8)

- [ ] Confirm the age threshold for Item 4.6 (verify against current CBHPM edition — thresholds have changed between editions)
- [ ] Confirm the age threshold for Item 4.7
- [ ] Confirm any applicable conditions for Item 4.8 (neonatal / specific clinical criteria)
- [ ] Confirm the multiplier percentage for each applicable item
- [ ] **[BLOCKING]** Confirm that the pediatric adjustment is applied to the surgeon's honorarium **before** computing auxiliary fees
- [ ] Confirm that the patient age input is required and validated at the entry point

---

## Phase 10: Auxiliary Remuneration Validation (Items 5.1 / 5.2)

- [ ] **[BLOCKING]** Confirm the 1st auxiliary percentage (cite CBHPM Item 5.1 — typically 30%)
- [ ] **[BLOCKING]** Confirm the base for the 1st auxiliary = surgeon's **total adjusted** honorarium (including pediatric adjustments and all procedure groupings)
- [ ] **[BLOCKING]** Confirm the 2nd auxiliary percentage (cite CBHPM Item 5.2 — typically 30% of the 1st auxiliary)
- [ ] Confirm the base for the 2nd auxiliary = 1st auxiliary's honorarium (cascading, not re-applied to surgeon)
- [ ] Confirm the maximum number of auxiliaries recognized (cite CBHPM — typically capped)
- [ ] **[WARNING]** If more auxiliaries are requested than the CBHPM maximum, confirm the system's behavior (reject, warn, or cap silently)

---

## Phase 11: Numeric Constants Audit

For every numeric constant (decimal, percentage, or multiplier) present in the changed code:

- [ ] Is it documented with an inline comment citing its CBHPM source?
- [ ] Does the value in the code match the cited source exactly?
- [ ] Is the constant defined in a single location (no duplication across files)?
- [ ] **[BLOCKING]** If a constant has no citation: flag as undocumented and block approval

---

## Phase 12: Contradiction Detection

- [ ] Compare all rules applied in this change against existing rules in `docs/valuation-validation.md`
- [ ] Check for any prior audit that addressed the same CBHPM items — are the conclusions consistent?
- [ ] Verify that no rule from one CBHPM item silently overrides a rule from another when combined
- [ ] Check for any `if/else` or special-case logic in the implementation that is not reflected in the documentation
- [ ] **[WARNING]** Flag any special case that exists in code but has no corresponding documented rule

---

## Phase 13: Example Generation

- [ ] Generate at least 3 worked examples (see format in [examples.md](examples.md))
- [ ] Example 1 must exercise the primary rule being changed
- [ ] Example 2 must exercise an edge case (tie-breaking, maximum auxiliaries, age boundary, etc.)
- [ ] Example 3 must combine the changed rule with at least one other rule (e.g., Item 4.1 + Item 5.2)
- [ ] Verify each example's output manually (do not rely on the implementation to validate itself)
- [ ] Confirm that the worked examples produce results consistent with documentation

---

## Phase 14: Risk Documentation

- [ ] List every edge case that was identified but not fully resolved
- [ ] List every assumption that was necessary due to ambiguous documentation
- [ ] List every CBHPM edition discrepancy discovered
- [ ] Document any interaction between rules that may produce unexpected results in untested combinations

---

## Phase 15: Final Recommendation

Issue one of:

### Approved

All BLOCKING items are confirmed. All WARNING items are documented in the Risks section. At least 3 worked examples are present and correct. Every numeric constant has a citation.

### Requires Clarification

One or more BLOCKING items could not be confirmed because documentation is missing, ambiguous, or inaccessible. State exactly:
- Which item is blocked
- What document is needed
- Who should provide it

Do not issue "Approved" with unresolved BLOCKING items.

### Reject

The change contains an incorrect formula, a contradicted rule, or an undocumented hardcoded constant that cannot be resolved without modifying the implementation. State:
- What is incorrect
- What the correct behavior should be (with citation)
- What must change before re-submission

---

## Quick Reference: CBHPM Items Covered by This Skill

| Item   | Subject                                       |
|--------|-----------------------------------------------|
| 4.1    | Múltiplos procedimentos, mesmo acesso         |
| 4.2    | Múltiplos procedimentos, acessos diferentes   |
| 4.3    | Procedimentos bilaterais                      |
| 4.5    | Procedimentos integrados                      |
| 4.6    | Acréscimo pediátrico (< 7 anos)               |
| 4.7    | Acréscimo pediátrico (7–12 anos)              |
| 4.8    | Acréscimo neonatal / condições específicas    |
| 5.1    | Remuneração do 1º auxiliar                   |
| 5.2    | Remuneração do 2º auxiliar e subsequentes     |
