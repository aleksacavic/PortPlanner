# Procedure 04 — Post-Commit Review Protocol (Read-Only Audit)

> **RFC 2119 convention**: "MUST", "MUST NOT", "SHALL", "SHOULD", and "MAY"
> carry their standard meanings throughout this document.

---

## Prerequisite

Before starting, MUST have read
`docs/procedures/Claude/00-architecture-contract.md`. This procedure
assumes knowledge of binding specifications, Ground Rules (GR-1/2/3), and
the Approved Deviation Protocol.

---

## 4.0) Operating Mode

This is a **read-only audit**. Output is a review memo.

- MUST NOT code.
- MUST NOT edit source files.
- MUST NOT propose "implementation steps only" — this is an audit memo.
- Write the memo in chat with evidence.

**Relationship to Procedure 05 (Remediation):**

This procedure produces the audit findings. If fixes are needed, hand off
to Procedure 05 (Post-Commit Remediation) which handles the fix-audit-refix
loop. This procedure MUST NOT fix anything itself.

---

## 4.1) Scope and Depth (non-negotiable)

- Review **every file touched** in the target commit range.
- No "glance-only" reviews.
- At the end, MUST include:
  1. Full file list reviewed.
  2. Per-file verdict (OK / issue found).
  3. Coverage statement confirming all changed files were inspected.

---

## 4.2) Core Audit Questions (answer explicitly)

1. Is the change necessary and materially beneficial?
2. Is implementation complete vs the stated plan?
3. Does implementation match binding specifications
   (00-architecture-contract.md §0.2)?
4. Is architecture improved or regressed?
5. What gaps / regressions remain?
6. **User-visible behavior trace (added 2026-05-01).** For every row
   in the plan's §1.5.1 User-Visible Behavior Walkthrough table,
   trace the visible result through the actual diff: which committed
   file:line produces the visible affordance / pixel / DOM change
   the row promises? "Tests assert this row" is necessary but not
   sufficient — tests can pass on the commit-time path while the
   draft-time / preview-time path is unwired. A row whose claimed
   visible result has no corresponding diff site is a Blocker. Lesson
   source: M1.3 DI pipeline overhaul Phases 5/6 — original Phase 3
   claimed B7 was delivered, all unit tests passed, Codex Round 4
   returned Go 9.8/10 — but the user's first manual smoke surfaced
   "doesn't work at all" because the visible result (rubber-band
   freezes on Tab) had no corresponding diff site (only commit-time
   combiner was wired, not draft-time previewBuilder).
7. Final rating (1-10) with justification.

Also explicitly verify each of the following against the relevant ADR:

- **ADR-001 coordinate system** — no screen-pixel math, no lat/lng
  engineering computation.
- **ADR-002 object model** — analysis bindings, cost bindings, mesh
  descriptors are separate records; typed fields are first-class columns;
  JSONB carries only extensible payload.
- **ADR-003 ownership states** — transitions correctly tracked; FROZEN
  and DETACHED handled.
- **ADR-004 extraction contract** — extractor version matches registry;
  output bundle shape matches registry; scenario overrides respected.
- **ADR-005 library model** — snapshots record source version; no live-
  link references; overrides tracked with reason.
- **ADR-006 scenario model** — V1 is parameter overlay only; geometry
  branching deferred; `scenario_id` column exists on touched records.
- **ADR-007 validation engine** — rules registered by scope and severity
  per registry entry; integrated into derivation pipeline.
- **ADR-008 3D cache** — if 3D touched, geometry_fingerprint complete;
  cache invalidated at object granularity; RENDER_VERSION respected.
- **ADR-009 RBAC** — permission checks at API boundary; UI gates are
  cosmetic, not authoritative.
- **ADR-010 document sync** — operations emitted with correct type and
  before/after snapshots; last-write-wins at object level.

Also verify:
- Module isolation (GR-3) — no cross-package imports violating dependency
  graph.
- Folder structure and file modularity (GR-3).
- Binding spec updates committed in the same commit as code changes (0.5).

---

## 4.3) Classification Up Front (mandatory)

Classify findings BEFORE details:

- **Blockers** (MUST fix)
- **High-risk** (likely regressions / drift)
- **Quality gaps** (non-blocking polish)

No unclassified feedback.

---

## 4.4) Forced Completeness Scan (mandatory)

Explicitly scan for:

- Type/schema consistency (object contract per ADR-002).
- Extractor version alignment (registry ↔ code).
- Coordinate system violations (ADR-001).
- Phase/order coupling issues.
- Invariant enforcement + fallback semantics.
- Test gate quality (hard vs soft).
- Grep/gate enforceability (no policy without enforcement).
- Lifecycle cleanup (hydration boundaries, 3D cache invalidation,
  operation log flush).
- Contradictions against GR-1 / GR-2 / GR-3.
- Module isolation violations.
- Dead code or orphaned files from the refactor.
- Undeclared deviations from binding specs (would require §0.7 approval).
- SQL migration correctness (§4.5).

---

## 4.5) SQL Migration Scrutiny (mandatory when commit includes SQL)

If the committed changes include any SQL migration files, MUST perform
a dedicated SQL scrutiny pass. SQL migrations carry outsized risk and
MUST NOT be glance-reviewed.

### Required checks

1. **Schema change correctness**:
   - Column types, precision/scale, nullability, default values match
     design decisions.
   - CHECK constraints match documented invariant ranges.
   - FK constraints not weakened without DB-level replacement (GR-2).

2. **RPC function body completeness**:
   - If the commit updates an existing RPC, verify EVERY new column is
     wired in BOTH INSERT and UPDATE statements inside the function body.
   - Read the full function body — do not rely on grep alone. Confirm
     the column appears in the correct SQL statement (not just anywhere
     in the file).
   - Common failure: ALTER adds column but RPC INSERT/UPDATE not updated
     → silent data loss on save.

3. **Transaction atomicity**:
   - Schema changes and RPC updates MUST be in the same migration file
     or explicitly ordered.

4. **Existing RPC regression**:
   - Diff old and new RPC function. Verify no existing columns or logic
     silently dropped.

5. **Adapter ↔ RPC alignment**:
   - Cross-reference the library snapshot adapter or extractor field
     names against the RPC's JSONB key names. A mismatch (e.g.
     `teu_slots` in SQL vs `teuSlots` in adapter) causes silent data
     loss.
   - Verify extractor output keys match RPC `UPDATE ... SET` column
     names where extractions are persisted.

### Output

Include a "SQL Migration Scrutiny" subsection in the review output under
Deep Audit Findings, with per-check pass/fail verdicts and evidence
(file paths, line numbers, diff excerpts).

---

## 4.6) Extraction Registry Scrutiny (mandatory when commit adds/changes extractors)

If the commit adds or modifies extractors, validation rules, or object
types, MUST perform dedicated registry scrutiny.

### Required checks

1. **Registry entry exists** for every object type used by the commit.
2. **Version discipline**:
   - New extractor: entry version 1.0.0, output bundle reports 1.0.0.
   - Formula change: patch bump (registry + output bundle).
   - New output field: minor bump.
   - Breaking change: major bump + migration note.
3. **Extractor output keys** match registry entry exactly (case, spelling,
   units).
4. **Validation rules in code** match rules listed in registry (same IDs,
   severities, conditions).
5. **Changelog updated** in the registry entry for any version bump.

---

## 4.7) Deviation Detection (mandatory)

Scan for any behaviour that deviates from binding specifications without
user approval.

### Red flags

- Implementation changes a documented formula but registry version
  unchanged.
- New validation rule in code but not in registry entry.
- New ownership state or transition added without superseding ADR.
- Coordinate math in screen pixels or lat/lng.
- Analysis bindings stored on the object record (ADR-002 violation).
- 3D scene cached at scene level rather than descriptor level (ADR-008
  violation).
- Library items referenced by live link rather than snapshot (ADR-005
  violation).
- Operation log not emitted for a document mutation (ADR-010 violation).

Any undeclared deviation = **Blocker**, regardless of whether the new
behaviour is otherwise reasonable. If the deviation was intentional, the
author should have followed the Approved Deviation Protocol; not doing
so is the Blocker.

---

## 4.8) Evidence Standard (strict)

- Every critical claim MUST cite concrete file-level proof (diffs, code
  snippets, test outputs, grep results).
- MUST NOT use "probably fine" language.
- If uncertain, run a check and report the result.
- For every Blocker/High-risk item, MUST include exact file path + line
  references.
- Include the command(s) used to validate each finding.

---

## 4.9) Multi-Round Behavior

- Round 1 = full 10/10 scrutiny.
- Subsequent rounds MUST start with prior item status:
  - **Resolved** — previously found, now fixed.
  - **Open** — previously found, still present.
  - **Regressed** — was resolved, now broken again.
  - **Review Miss** — should have been caught earlier but was not.
- MUST NOT repeat already-resolved points unless they regressed.
- Add new findings only when new diff text or prior misses justify them.
- If user calls out a miss, label it as **Review Miss** explicitly.
- If no round number is provided, infer from thread history.

---

## 4.10) Required Output Format (every round)

Use this exact structure:

1. **Round Header** (e.g., "Round 1 Post-Commit Audit")
2. **Classification Summary**
   - Blockers
   - High-risk
   - Quality gaps
3. **Architecture Compliance**
   - GR-1 assessment
   - GR-2 assessment
   - GR-3 assessment (module isolation + folder structure)
4. **Deep Audit Findings**
   - ADR-by-ADR verification (§4.2 list)
   - Coordinate system
   - Object model and JSONB discipline
   - Ownership states
   - Extraction contract
   - Library snapshots
   - Validation engine
   - 3D cache (if applicable)
   - Document sync and operation log
   - Hydration / serialization
5. **Extraction Registry Scrutiny** (§4.6, if applicable)
6. **SQL Migration Scrutiny** (§4.5, if applicable)
7. **Deviation Detection Results** (§4.7)
8. **Per-File Review Summary** (all touched files — path + verdict)
9. **Delta vs Previous Round** (Resolved / Open / Regressed / Review Miss)
   — skip for Round 1
10. **Done Criteria Checklist** (objective pass/fail)
11. **Final Rating (1-10)**
12. **Go / No-Go**

---

## 4.11) Binding Spec Doc Verification

MUST verify: "Do the committed changes alter behaviour described in any
binding spec (00-architecture-contract.md §0.2)?"

- If yes and docs were NOT updated: **Blocker**.
- If yes and docs were updated: verify updates are accurate, complete,
  and version-bumped where required.
- Check the plan file at `docs/plans/<branch-name>.md` — does it reflect
  the actual implementation?

---

## 4.12) Closure Discipline

MUST NOT close with "looks good" alone.

Always provide objective done criteria that can close in 1-2 rounds.

No closure without:
- Zero Blockers.
- Explicit handling of every High-risk item (fixed or risk-accepted with
  rationale).
- Per-file coverage statement (all touched files reviewed).
- Enforceable verification for all critical claims.
- Binding specs confirmed current.
- Plan file confirmed current.
- No undeclared deviations.
