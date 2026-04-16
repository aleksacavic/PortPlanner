# Procedure 02 — Plan Review (Codex Sceptical Second-Opinion Posture)

> **RFC 2119 convention**: "MUST", "MUST NOT", "SHALL", "SHOULD", and "MAY"
> carry their standard meanings throughout this document.

---

## Prerequisite

Before starting, MUST have read
`docs/procedures/Codex/00-architecture-contract.md`. This procedure
assumes knowledge of binding specifications, Ground Rules (GR-1/2/3), and
the Approved Deviation Protocol.

---

## 2.0) Operating Mode and Posture

This is a **review/scrutiny task only**.

- MUST NOT code.
- MUST NOT modify source files.
- MUST NOT commit.
- MUST NOT author or patch the plan. If the plan is deficient, the
  plan author fixes it — Codex does not edit.
- Output is a review memo in chat.

**Codex-specific posture:** Codex is a second-opinion reviewer. Claude
authored this plan, ran three internal review rounds on it, and emitted
it for review. Assume:

- Claude may have missed something a fresh reader would catch.
- Claude's self-review may have been insufficient or self-confirming.
- Claude may have drifted from binding specs in ways its own reviewer
  persona did not flag.

This posture is not hostile — it is the reason Codex exists as a second
opinion. The value is in catching what Claude missed, not in agreeing
with Claude's conclusions.

---

## 2.1) Round-1 Review Standard (Maximum Scrutiny)

Start Round 1 as a full **10/10 gate review**. MUST answer every question
with evidence, treating Claude's stated conclusions as claims to verify
rather than facts to accept.

1. Is the plan's understanding of the request correct? Re-derive the
   request from the plan text without reading Claude's restatement —
   does it match?
2. Is the plan compliant with GR-1, GR-2, and GR-3?
3. Does the plan align with binding specifications? Cite each ADR and
   registry entry referenced and verify the plan matches the spec.
4. Is the plan SSOT + DRY + scalable?
5. Does the plan correctly handle hydration, serialization, and document
   sync per ADR-010?
6. Does the plan correctly integrate with the extraction contract
   (ADR-004)?
7. Does the plan correctly handle ownership state transitions (ADR-003)?
8. Does the plan respect coordinate system discipline (ADR-001)?
9. Does the plan respect the object model split (ADR-002)?
10. Does the plan handle undo/redo correctly (ADR-010)?
11. Are all invariants enforced via gates?
12. Are any deviations properly flagged per §0.7 Approved Deviation
    Protocol?
13. **Sceptical reader check**: could a developer unfamiliar with this
    request implement this plan without guessing? What's hand-waved?
14. **Self-review check**: what would Claude's three internal review
    rounds likely have missed? Look for concerns that a self-reviewer
    wouldn't flag because they share context with the author.
15. What are the gaps?
16. Final rating (1-10) + Go/No-Go.

---

## 2.2) Findings Classification (mandatory, up front)

Classify findings BEFORE details:

- **Blockers** (MUST fix before implementation)
- **High-risk** (likely regression / architectural drift)
- **Quality gaps** (non-blocking polish)

No ambiguous comments. Every issue MUST be classified.

---

## 2.3) Pre-Response User Notification (mandatory, every round)

After evidence gathering and classification but before writing the formal
review response (§2.9), MUST output a concise tabulated notification in
chat.

### Required tables

**Blockers:**

| # | Blocker | Agree/Disagree | Root Cause (author error or procedure gap?) | Proposed Rule Enhancement |
|---|---------|----------------|--------------------------------------------|---------------------------|

**High-risk:**

| # | High-risk item | Agree/Disagree | Root Cause | Proposed Rule Enhancement |
|---|---------------|----------------|------------|---------------------------|

**Deviations requiring approval:**

| # | Deviation | Binding spec | Proper protocol followed? | Recommendation |
|---|-----------|--------------|---------------------------|----------------|

**Self-review misses identified** (Codex-specific):

| # | What Claude's self-review should have caught | Why it was missed | Severity |
|---|----------------------------------------------|-------------------|----------|

**Resolved from prior round** (Round 2+ only):

| # | Prior item | Resolved? | Notes |
|---|-----------|-----------|-------|

### Rules

- Chat only, not appended to the plan file.
- MUST be output every round.
- MUST wait for user acknowledgment before writing the formal review
  response.
- The "Self-review misses" table is specific to Codex's second-opinion
  role. Use it to surface patterns that would help Claude's self-review
  protocol improve over time.

---

## 2.4) Forced Completeness Scan (mandatory)

Explicitly scan for:

- Type/schema consistency (object contract per ADR-002).
- Extraction contract conformance (inputs, outputs, version per ADR-004
  and registry entry).
- Coordinate system discipline (ADR-001) — no screen-pixel math, no
  lat/lng engineering computation.
- Ownership state transitions (ADR-003) — every mutation identifies
  pre-state and post-state transition.
- Validation engine integration (ADR-007) — rules registered by scope
  and severity per registry.
- Mesh descriptor fingerprinting (ADR-008) — if 3D is in scope,
  fingerprint inputs complete.
- Library snapshot integrity (ADR-005) — no live-link references.
- Scenario overlay discipline (ADR-006) — no geometry branching claims
  in V1.
- RBAC checks at API boundary (ADR-009).
- Operation log emissions (ADR-010).
- Phase-order coupling.
- Invariant enforcement via gates.
- Test gates hard vs soft.
- Lifecycle cleanup paths.
- Module isolation per GR-3.
- SQL migration correctness (§2.5) if applicable.
- **Architectural patterns Claude tends to miss** (Codex-specific):
  - Cross-cutting concerns treated as single-object problems.
  - Ownership state transitions in edge cases (generator race conditions,
    partial regenerations, concurrent user edits).
  - Scenario overlay impact on derived outputs.
  - Library snapshot impact when source library updates.
  - 3D cache invalidation when cross-object effects change.

---

## 2.5) SQL Migration Scrutiny (mandatory when plan includes SQL)

Same checks as Claude's Procedure 02 §2.5. Same output format.

Codex-specific emphasis: read the current live RPC function and diff
against the proposed replacement line-by-line. Do not trust the plan's
claim that "only these columns are added" — verify.

---

## 2.6) Extraction Registry Scrutiny (mandatory when plan adds/changes extractors)

Same checks as Claude's Procedure 02 §2.6.

Codex-specific emphasis: verify the registry entry was updated as part
of the plan, not promised to be updated during execution. Specifications
written after the fact are not specifications.

---

## 2.7) Deviation Scrutiny (mandatory when plan proposes deviations)

Same checks as Claude's Procedure 02 §2.7.

Codex-specific emphasis:
- Verify the deviation section in the plan is not just a justification
  for a decision already made. It MUST propose a concrete replacement
  (new superseding ADR, or registry entry patch), and that replacement
  must be written out.
- Verify user approval is recorded with date and reason, not just
  "approved."
- Verify the plan commits the spec update alongside the implementation,
  not in a follow-up PR.

---

## 2.8) Multi-Round Behavior

- MUST NOT drip-feed previously known issues.
- Mark previously addressed items as **Resolved**.
- Re-raise only unresolved or regressed items.
- New comments only when new plan text introduces new issues.
- If reviewer identifies a missed issue from a prior round, tag it as
  **Review Miss**.
- If no round number is provided, infer from thread history.

---

## 2.9) Required Output Format (every review round)

1. **Round Header** (e.g., "Codex Round 1 Plan Review")
2. **Classification Summary**
   - Blockers
   - High-risk
   - Quality gaps
3. **Scrutiny Matrix** (item-by-item assessment against §2.1 questions)
4. **Self-Review Miss Assessment** (Codex-specific) — patterns Claude's
   self-review should have caught
5. **Forced Completeness Scan Results**
6. **Extraction Registry Scrutiny Results** (if applicable)
7. **SQL Migration Scrutiny Results** (if applicable)
8. **Deviation Scrutiny Results** (if applicable)
9. **Resolved Since Prior Round** (skip for Round 1)
10. **Open Items**
11. **Done Criteria Checklist**
12. **Final Rating (1-10)**
13. **Go / No-Go**

---

## 2.10) Handback to Claude

If the review produces Blockers or High-risk items requiring plan
revision:

- Codex does not edit the plan.
- Codex emits the full review memo in chat.
- The user hands the memo back to Claude for plan revision per Claude's
  Procedure 01 scrutiny response protocol.
- Codex performs the next review round on the revised plan.

---

## 2.11) Closure Discipline

Deliver a **Done Criteria checklist** that enables closure in 1-2 rounds
via objective pass/fail.

No closure without:
- Zero Blockers.
- Explicit handling of every High-risk item.
- Enforceable gates for all critical claims.
- Binding-spec updates assessed and matches spec realities.
- All deviations follow Approved Deviation Protocol.
- Self-review miss patterns surfaced for Claude's procedure improvement.
