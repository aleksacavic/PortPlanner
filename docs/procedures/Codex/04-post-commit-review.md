# Procedure 04 — Post-Commit Review (Codex Sceptical Second-Opinion Posture)

> **RFC 2119 convention**: "MUST", "MUST NOT", "SHALL", "SHOULD", and "MAY"
> carry their standard meanings throughout this document.

---

## Prerequisite

Before starting, MUST have read
`docs/procedures/Codex/00-architecture-contract.md`. This procedure
assumes knowledge of binding specifications, Ground Rules (GR-1/2/3),
and the Approved Deviation Protocol.

---

## 4.0) Operating Mode and Posture

This is a **read-only audit**. Output is a review memo.

- MUST NOT code.
- MUST NOT edit source files.
- MUST NOT propose "implementation steps only" — this is an audit memo.
- MUST NOT remediate. If fixes are needed, hand back to Claude for
  remediation per Claude's Procedure 05.
- Write the memo in chat with evidence.

**Codex-specific posture:** Claude already self-reviewed this commit
range per its own Procedure 03 §3.9 and Procedure 04. This is a
second-opinion audit. Assume:

- Claude's self-review may have been incomplete.
- Claude may have self-confirmed conclusions that a fresh reader would
  challenge.
- Claude may have drifted from binding specs in ways its own reviewer
  persona did not flag.
- Implementation choices that look defensible in context may still
  violate binding specs when viewed against the contract directly.

Read the commit diff first. Do not read Claude's self-review memo until
after forming independent findings. Compare afterwards.

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
6. Final rating (1-10) with justification.

Also explicitly verify each ADR against the commit:

- **ADR-001 coordinate system** — no screen-pixel math, no lat/lng
  engineering computation.
- **ADR-002 object model** — analysis bindings, cost bindings, mesh
  descriptors are separate records; typed fields are first-class
  columns; JSONB carries only extensible payload.
- **ADR-003 ownership states** — transitions correctly tracked; FROZEN
  and DETACHED handled.
- **ADR-004 extraction contract** — extractor version matches registry;
  output bundle shape matches registry; scenario overrides respected.
- **ADR-005 library model** — snapshots record source version; no
  live-link references; overrides tracked with reason.
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
- Binding spec updates committed in the same commit as code changes.

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
- Undeclared deviations from binding specs.
- SQL migration correctness (§4.5).

**Codex-specific scrutiny patterns** (what Claude's self-review tends
to miss):

- Generator race conditions on ownership state transitions.
- Library snapshot-vs-override inconsistencies when both are edited.
- Scenario overlay cascading effects through cross-object extractors.
- Mesh descriptor invalidation missed for objects affected indirectly.
- Operation log entries that don't round-trip on replay.
- Extraction bundle keys that match the registry in spelling but differ
  in units or semantics.
- Validation rule severity mismatches between registry and implementation.
- RBAC checks present in UI but absent at the API.

---

## 4.5) SQL Migration Scrutiny (mandatory when commit includes SQL)

Same checks as Claude's Procedure 04 §4.5.

Codex-specific emphasis: do not trust adapter field naming consistency
claims. Run `rg` for the exact field name across adapter code and SQL
migration — verify identical spelling, identical case.

---

## 4.6) Extraction Registry Scrutiny (mandatory when commit adds/changes extractors)

Same checks as Claude's Procedure 04 §4.6.

Codex-specific emphasis:
- Verify the registry entry was updated in the same commit as the code,
  not in a separate preparatory commit.
- Verify the registry changelog entry dates match the commit date.
- Verify the version bump matches the change type (patch/minor/major
  discipline per ADR-004).

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
- RBAC gate only in UI, not at API (ADR-009 violation).

Any undeclared deviation = **Blocker**, regardless of whether the new
behaviour is reasonable. If the deviation was intentional, the Approved
Deviation Protocol should have been followed.

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
- If the user calls out a miss, label it as **Review Miss** explicitly.
- If no round number is provided, infer from thread history.

---

## 4.10) Required Output Format (every round)

1. **Round Header** (e.g., "Codex Round 1 Post-Commit Audit")
2. **Classification Summary**
   - Blockers
   - High-risk
   - Quality gaps
3. **Architecture Compliance**
   - GR-1 assessment
   - GR-2 assessment
   - GR-3 assessment
4. **ADR-by-ADR Verification** (§4.2 list)
5. **Self-Review Miss Assessment** (Codex-specific) — what Claude's
   Procedure 04 self-review should have caught but didn't
6. **Deep Audit Findings**
   - Coordinate system
   - Object model and JSONB discipline
   - Ownership states
   - Extraction contract
   - Library snapshots
   - Validation engine
   - 3D cache (if applicable)
   - Document sync and operation log
   - Hydration / serialization
7. **Extraction Registry Scrutiny** (if applicable)
8. **SQL Migration Scrutiny** (if applicable)
9. **Deviation Detection Results**
10. **Per-File Review Summary** (all touched files — path + verdict)
11. **Delta vs Previous Round** (Resolved / Open / Regressed / Review
    Miss) — skip for Round 1
12. **Done Criteria Checklist** (objective pass/fail)
13. **Final Rating (1-10)**
14. **Go / No-Go**

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

## 4.12) Handback to Claude

If the review produces Blockers or High-risk items:

- Codex does not fix.
- Codex emits the full review memo in chat.
- The user hands the memo back to Claude for remediation per Claude's
  Procedure 05 (Post-Commit Remediation).
- Codex performs the next review round on the remediated commit range.

---

## 4.13) Closure Discipline

MUST NOT close with "looks good" alone.

Always provide objective done criteria that can close in 1-2 rounds.

No closure without:
- Zero Blockers.
- Explicit handling of every High-risk item.
- Per-file coverage statement.
- Enforceable verification for all critical claims.
- Binding specs confirmed current.
- Plan file confirmed current.
- No undeclared deviations.
- Self-review miss patterns surfaced for Claude's procedure improvement.
