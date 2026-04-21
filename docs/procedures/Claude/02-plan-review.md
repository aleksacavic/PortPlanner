# Procedure 02 — Plan Review Protocol (Pre-Commit Scrutiny)

> **RFC 2119 convention**: "MUST", "MUST NOT", "SHALL", "SHOULD", and "MAY"
> carry their standard meanings throughout this document.

---

## Prerequisite

Before starting, MUST have read
`docs/procedures/Claude/00-architecture-contract.md`. This procedure
assumes knowledge of binding specifications, Ground Rules (GR-1/2/3), and
the Approved Deviation Protocol.

---

## 2.0) Operating Mode

This is a **review/scrutiny task only**.

- MUST NOT code.
- MUST NOT modify source files.
- MUST NOT commit.
- Plan is read from `docs/plans/<branch-name>.md` on the feature
  branch pushed to `origin` (per Procedure 01 §1.10). An uncommitted
  plan cannot be reviewed — hand back to the plan author if missing.
- Output is a review memo in chat, or appended to the plan file when
  requested.

---

## 2.1) Round-1 Review Standard (Maximum Scrutiny)

Start Round 1 as a full **10/10 gate review**. MUST answer every question
explicitly with evidence:

1. Is the plan's request correctly understood?
2. Is the plan compliant with GR-1, GR-2, and GR-3
   (see 00-architecture-contract.md §0.4)?
3. Does the plan align with binding specifications in
   00-architecture-contract.md §0.2? Cite each ADR and registry entry
   referenced.
4. Is the plan SSOT + DRY + scalable?
5. Does the plan correctly handle hydration, serialization, and document
   sync per ADR-010?
6. Does the plan correctly integrate with the extraction contract
   (ADR-004)?
7. Does the plan correctly handle ownership state transitions (ADR-003)?
8. Does the plan respect coordinate system discipline (ADR-001)? No
   screen-pixel math. No lat/lng engineering computation.
9. Does the plan respect the object model split (ADR-002)? Analysis and
   cost bindings live on separate records, not on the object.
10. Does the plan handle undo/redo for relevant mutations (ADR-010)?
11. Are all invariants enforced via gates (01 §1.8)?
12. Are any deviations from binding specs properly flagged per §0.7
    Approved Deviation Protocol?
13. What are the gaps?
14. Final rating (1-10) + Go/No-Go.

---

## 2.2) Findings Classification (mandatory, up front)

Classify findings BEFORE details:

- **Blockers** (MUST fix before implementation)
- **High-risk** (likely regression / architectural drift)
- **Quality gaps** (non-blocking polish)

No ambiguous comments. Every issue MUST be classified.

---

## 2.3) Pre-Response User Notification (mandatory, every round)

After evidence gathering and classification for **each review round** but
**before** writing the formal review response (§2.9), MUST output a concise
tabulated notification in chat.

### Required tables

**Blockers:**

| # | Blocker | Agree/Disagree | Root Cause (author failed to follow procedure, or procedure failed to prevent?) | Proposed Rule Enhancement |
|---|---------|---------------|---------------------------------------------------------------------------------|---------------------------|

**High-risk:**

| # | High-risk item | Agree/Disagree | Root Cause | Proposed Rule Enhancement |
|---|---------------|----------------|------------|---------------------------|

**Deviations requiring approval:**

| # | Deviation | Binding spec | Proper protocol followed? | Recommendation |
|---|-----------|--------------|---------------------------|----------------|

**Resolved from prior round** (Round 2+ only):

| # | Prior item | Resolved? | Notes |
|---|-----------|-----------|-------|

### Rules

- Chat only, not appended to the plan file.
- MUST be output every round.
- "Agree" means reviewer considers this a real issue that must be addressed.
  "Disagree" MUST include justification.
- "Root Cause" distinguishes author error (rule existed, not followed) from
  procedure gap (no rule existed to prevent). Drives continuous improvement.
- "Proposed Rule Enhancement" is concrete text for
  `01-plan-authoring.md`, or "N/A — author error".
- MUST wait for user acknowledgment before writing the formal review
  response (§2.9).

---

## 2.4) Forced Completeness Scan (mandatory)

Explicitly scan for:

- Type/schema consistency (object contract per ADR-002).
- Extraction contract conformance (inputs, outputs, version per ADR-004
  and registry entry).
- Coordinate system discipline (ADR-001) — no screen-pixel math, no
  lat/lng engineering computation, no mixing units.
- Ownership state transitions (ADR-003) — every mutation identifies the
  pre-state and post-state transition.
- Validation engine integration (ADR-007) — rules registered by scope,
  severity, object type.
- Mesh descriptor fingerprinting (ADR-008) — if 3D is in scope, the
  fingerprint inputs are complete.
- Library snapshot integrity (ADR-005) — no live-link references to the
  platform or tenant libraries.
- Scenario overlay discipline (ADR-006) — no geometry branching claims
  in V1.
- RBAC checks at the API boundary (ADR-009).
- Operation log emissions (ADR-010) — every mutation emits a typed
  operation.
- Phase-order coupling (does phase N depend on phase N-1 in ways not
  stated?).
- Invariant enforcement via gates (no policy without enforcement).
- Test gates hard vs soft (hard gates MUST return zero; soft gates are
  informational).
- Lifecycle cleanup paths (hydration boundaries, 3D cache invalidation,
  operation log flush).
- Module isolation per GR-3 (no cross-package imports violating the
  dependency graph).
- Folder ownership and file modularity per GR-3.
- SQL migration correctness (§2.5) if plan includes SQL.

---

## 2.5) SQL Migration Scrutiny (mandatory when plan includes SQL)

If the plan includes any SQL migration files (schema changes, RPC function
updates, triggers, policies), MUST perform a dedicated SQL scrutiny pass.
SQL migrations carry outsized risk and MUST NOT be glance-reviewed.

### Required checks

1. **Schema change correctness**:
   - Column types, precision/scale, nullability, default values explicitly
     specified and match design decisions.
   - CHECK constraints match documented invariant ranges exactly.
   - FK constraints not weakened without DB-level replacement (GR-2).

2. **RPC function body completeness**:
   - If the plan updates an existing RPC, MUST verify EVERY new column is
     wired in BOTH the relevant INSERT and UPDATE statements inside the
     function body.
   - Common failure mode: ALTER adds the column, but RPC INSERT/UPDATE
     is not updated → column silently defaults to null on save, causing
     data loss of user-entered values.
   - **Gate requirement**: Plan MUST include grep gates targeting the RPC
     function body specifically. Example:
     `rg -n "new_column_name" <migration_file>.sql` with expected match
     inside `INSERT INTO` and `UPDATE ... SET`.

3. **Transaction atomicity**:
   - Schema changes and RPC updates are in the same migration file or
     explicitly ordered with rollback safety.

4. **Existing RPC compatibility**:
   - Read the current live RPC function. Verify `CREATE OR REPLACE` does
     not silently drop existing columns or logic.

5. **Adapter ↔ RPC alignment**:
   - Cross-reference the library snapshot adapter field names against
     the RPC's JSONB key names. A mismatch (e.g. `teu_slots` in SQL
     vs `teuSlots` in adapter) causes silent data loss.
   - Verify extractor output keys match the RPC's `UPDATE ... SET` column
     names where extractions are persisted.

### Output

Include a "SQL Migration Scrutiny" subsection in the review output under
Forced Completeness Scan Results, with per-check pass/fail verdicts and
evidence (file paths, line numbers, diff excerpts).

---

## 2.6) Extraction Registry Scrutiny (mandatory when plan adds/changes extractors)

If the plan adds a new object type, a new extractor, a new validation rule,
or modifies an existing extractor formula, MUST perform dedicated registry
scrutiny.

### Required checks

1. **Registry entry exists before implementation** (per ADR-004 and
   registry governance).
2. **Version discipline**:
   - New extractor: version starts at 1.0.0.
   - Formula change: patch bump (X.Y.Z → X.Y.Z+1).
   - New optional output field: minor bump.
   - Breaking change to output shape: major bump with migration note.
3. **Extractor version in output bundle matches registry entry version.**
4. **Validation rules in the registry entry match rules registered in
   code.** Same IDs, same severities, same conditions.
5. **Cross-object extractors** (e.g. YARD_CAPACITY_SUMMARY): the sources
   listed in the registry entry match the actual dependencies in code.
6. **Scenario override compatibility**: the output shape supports
   per-quantity overrides per ADR-004.

---

## 2.7) Deviation Scrutiny (mandatory when plan proposes deviations)

If the plan proposes any deviation from a binding specification, MUST
verify the Approved Deviation Protocol (00-architecture-contract.md §0.7)
is followed.

### Required checks

1. Deviation is named explicitly in the plan.
2. Deviation is justified: what's wrong with the current spec, what was
   missed, why adapting implementation is not sufficient.
3. Replacement is concrete: new superseding ADR written, or registry
   entry patch with version bump, or glossary/tokens update.
4. Deviation is flagged in the pre-response notification (§1.13).
5. User approval recorded in the plan file.
6. Spec update will commit with implementation, not separately.

Failure of any of these = **Blocker**, regardless of how good the
deviation idea is.

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

Use this exact structure:

1. **Round Header** (e.g., "Round 1 Plan Review")
2. **Classification Summary**
   - Blockers
   - High-risk
   - Quality gaps
3. **Scrutiny Matrix** (item-by-item assessment against §2.1 questions)
4. **Forced Completeness Scan Results** (§2.4 checklist)
5. **Extraction Registry Scrutiny Results** (§2.6, if applicable)
6. **SQL Migration Scrutiny Results** (§2.5, if applicable)
7. **Deviation Scrutiny Results** (§2.7, if applicable)
8. **Resolved Since Prior Round** (skip for Round 1)
9. **Open Items**
10. **Done Criteria Checklist** (objective pass/fail)
11. **Final Rating (1-10)**
12. **Go / No-Go**
13. **Revision-discipline reminder** (mandatory when output is
    No-Go — see §2.10)

---

## 2.10) Scrutiny Response Protocol (for revised plans)

When the plan author responds with a revised plan, MUST include an appendix:

### Appendix — Scrutiny Assessment and Actions

For each prior review item:
- Reviewer item ID/title
- Decision: **Agree** / **Disagree** / **Partial**
- Rationale
- Plan updates made (phase + step references)
- If rejected: why rejection is safe

Rules:
- Preserve history across rounds (append only; MUST NOT rewrite history).
- Investigate root cause + blast radius + edge cases, not narrow fixes.
- Ensure accepted items are reflected in updated phases/gates/tests.
- If accepted items change scope, verify architecture doc impact list is
  updated.

### Mandatory revision-discipline reminder (every No-Go handback)

Every review memo that classifies the plan as No-Go MUST close with
an explicit reminder directing the plan author to re-read the
revision-discipline rules before responding. The reminder is NOT
optional; its absence is a procedure miss on the reviewer side.

Reminder template (copy verbatim or paraphrase while preserving
every point):

> **Before revising the plan in response to these findings, the plan
> author MUST:**
>
> 1. Re-read Procedure 01 §1.3 (Three internal review rounds —
>    Chief Architect / Sceptical Reader / Blast Radius) and run
>    the self-audit on the REVISED plan text, not just on the
>    original.
> 2. Re-read Procedure 01 §1.13 (Pre-response notification) and
>    emit the tabulated notification in chat BEFORE committing
>    and pushing the revised plan file.
> 3. Re-read Procedure 01 §1.16 step 12 (Section-consistency
>    pass) and grep the plan body for references to any removed
>    or renamed concept after the revision.
> 4. Re-read Procedure 01 §1.16 step 13 (Revisions follow the
>    same closure discipline as initial authoring) — confirming
>    that §1.3 + §1.13 + §1.16 step 12 all apply to revised
>    emissions, not only to the first authoring.
> 5. Re-read Procedure 02 §2.10 (Scrutiny Response Protocol) and
>    append the Appendix — Scrutiny Assessment and Actions to
>    the plan file with per-finding Decision / Rationale /
>    Plan-updates entries.
>
> Reacting to review findings is not a substitute for independent
> self-audit.

---

## 2.11) Closure Discipline

Deliver a **Done Criteria checklist** that enables closure in 1-2 rounds
via objective pass/fail.

No closure without:
- Zero Blockers.
- Explicit handling of every High-risk item (fixed or risk-accepted with
  rationale).
- Enforceable gates for all critical claims.
- Architecture doc impact assessed and matches binding-spec realities.
- GR-3 module isolation and folder structure verified.
- All deviations follow Approved Deviation Protocol and have user approval.
