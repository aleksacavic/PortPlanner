# Procedure 03 — Plan Execution Protocol (Audit-First)

> **RFC 2119 convention**: "MUST", "MUST NOT", "SHALL", "SHOULD", and "MAY"
> carry their standard meanings throughout this document.

---

## Prerequisite

Before starting, MUST have read
`docs/procedures/Claude/00-architecture-contract.md` and the approved
plan file at `docs/plans/<branch-name>.md`.

---

## 3.0) Execution Mode

- MUST implement now (not planning mode).
- MUST work phase-by-phase in order as defined in the approved plan.
- Before coding each phase: MUST publish a TODO list for the current
  phase only.
- After coding each phase: MUST run a **Phase Audit** before moving on.
- If audit finds issues: MUST fix them immediately, re-audit that phase.
- MUST NOT proceed to the next phase until the current phase is fully
  green.
- MUST NOT deviate from the approved plan. If mid-execution you discover
  a reason to deviate, stop and follow §3.10.

### 3.0.1) Pre-Phase-1 plan-vs-code re-grounding (mandatory — added 2026-04-28)

Before writing the first line of code in Phase 1, MUST perform a
plan-vs-code re-grounding audit:

1. **Read every file the plan cites for modification.** Confirm the file
   exists, the shape matches the plan's described shape, and any cited
   line numbers are reasonable.
2. **Read every file the plan cites for "the existing pattern is X".**
   Confirm X is actually the established pattern, not an assumed one.
3. **Read every file the plan cites for "extend class Y with methods
   M1/M2/M3".** Confirm Y exists as a class (not a factory function), and
   that the cited methods exist or are net-new additions consistent with
   the file's current structure.
4. **Drift between plan approval and execution start:** plans typically
   sit approved-but-unexecuted for hours-to-days. The codebase may have
   shifted (other branches merged into main, fixes applied, refactors
   landed). The pre-Phase-1 audit catches drift early, before code is
   written against an outdated plan.

If the audit finds plan-vs-code mismatches:
- MUST stop. MUST NOT silently adapt the implementation to match reality.
- MUST follow §3.10 mid-execution deviation protocol.
- The discovery is a **plan-authoring procedure violation** if the
  mismatch existed at plan-approval time (Procedure 01 §1.4.1 was not
  followed); a **drift discovery** if the mismatch arose between approval
  and execution-start. Both cases require §3.10.

**Lesson source:** M1.3 Round 6 discovered after Codex Round-6 Go that
the plan's `class ToolRunner` did not match the actual function-based
`startTool` runner. Five Codex review rounds and three Claude internal
self-audit rounds all failed to catch this because none of them did
plan-vs-code grounding. The cost was a §3.10 patch + Codex Round-7
re-review after a clean Go.

---

## 3.1) Mandatory Phase Discipline

For EACH phase, MUST output these sections in order:

1. **Phase Goal** — quoted from the plan.
2. **TODO List** — small, concrete, checkable items.
3. **Implementation** — what changed (files, functions, types).
4. **Phase Audit**:
   - **User-visible behavior walkthrough check (added 2026-05-01).** For
     every row in the plan's §1.5.1 User-Visible Behavior Walkthrough
     table that this phase delivers (per the "Implementation site"
     column), MUST verify the implementation actually produces the
     visible result by tracing from user-action → router/chrome →
     state-mutation → render. "Tests pass" is NOT sufficient evidence —
     tests can pass while delivering only the commit-time math without
     the mid-action visible affordance. If any row's site fails this
     trace, MUST follow §3.10 mid-execution deviation protocol to
     surface the gap (do NOT silently re-classify the row as "deferred"
     or "out of scope"). Lesson source: M1.3 DI pipeline overhaul
     Phases 5/6 — Phase 3 plan claimed B7 was delivered by combiner
     cursor-awareness, but no visible-behavior trace existed for "user
     types value → rubber-band reflects it" because the runner /
     previewBuilder were never wired to honor locks. The gap was
     caught only by user manual smoke after commit, requiring two
     additional phases to close.
   - Architecture / SSOT / DRY check against binding specs.
   - Module isolation check (GR-3) — no cross-package imports introduced
     that violate the dependency graph.
   - Coordinate system check (ADR-001) — no screen-pixel or lat/lng
     engineering math introduced.
   - Object model check (ADR-002) — analysis/cost bindings not on the
     object.
   - Ownership state check (ADR-003) — state transitions correct.
   - Extraction contract check (ADR-004) — extractor version in output
     matches registry version.
   - Library snapshot check (ADR-005) — no live-link library references.
   - Validation engine check (ADR-007) — rules registered by scope and
     severity per registry.
   - 3D cache check (ADR-008) — if 3D touched, fingerprint inputs complete.
   - RBAC check (ADR-009) — if permission-gated action, check happens at
     API boundary.
   - Document sync check (ADR-010) — operation emissions correct.
   - Hydration / serialization check.
   - Architecture doc delta — list doc updates made or confirm none needed.
   - Finding classification — any issues found MUST be classified as
     Blocker / High-risk / Quality gap.
5. **Mandatory Completion Gate(s)** — exact commands from the plan,
   expected result explicit. For grep gates: MUST return zero.
6. **Gate Results** — command + pass/fail for each.
7. **Phase Verdict** — GO / NO-GO.

---

## 3.2) Hard Rule: Completion Gates

- Every phase MUST have at least one Mandatory Completion Gate.
- If a phase includes migration / removal / reroute work, MUST include
  grep gates that return zero results.
- MUST NOT mark a phase complete if any gate fails.

### 3.2.1) Gate-regex pre-flight (added 2026-05-01)

Before executing the phase's grep gates, MUST mentally simulate each
"exactly N matches" or "zero matches" gate against the phase's
expected file state — including JSDoc comments + body reads + test
scaffolding. If the regex would match those non-declarative sites, the
gate is over-specified per Procedure 01 §1.8.1 and MUST be tightened
via §3.10 mid-execution deviation protocol BEFORE running the gate
(rather than discovering the over-match after-the-fact and patching
under time pressure).

This prevents the recurring failure mode (M1.3 DI pipeline overhaul
Phases 1, 3, 4 each required a §3.10 patch for an over-specified
grep gate). Five seconds of pre-flight saves a multi-step disclosure
+ ack round.
- **Gate failure recovery**: if a gate fails, MUST fix implementation
  within the same phase, then re-run ALL gates for that phase. Do NOT
  create a new phase for gate fixes. Do NOT proceed until fully green.

---

## 3.3) Audit Policy (strict)

Minimum two final audits at the end:

1. **Final Audit #1** — full system audit against the plan and binding specs.
2. **Final Audit #2** — independent re-audit (adopt a fresh reviewer
   posture).

If either final audit triggers fixes, MUST run another full audit after
those fixes. MUST repeat until the latest audit contains no new findings.

---

## 3.4) Binding Spec Update Gate

During Final Audit #1, MUST verify:

> "Does this execution change behaviour described in any binding spec
> listed in 00-architecture-contract.md §0.2?"

If yes:
- The relevant spec(s) MUST be updated before the phase is marked GO.
- Missing spec update = **Blocker**.
- Updates committed in the same commit as the code change.

Examples of required spec updates:
- New extractor output field → registry entry updated, version bumped.
- New validation rule → registry entry lists the rule.
- New ownership state behaviour → new superseding ADR (per §3.10 Approved
  Deviation Protocol).
- New design token → `docs/design-tokens.md` updated with changelog line.
- New domain term entering the codebase → `docs/glossary.md` entry added.

---

## 3.5) Final Output Requirements

At completion, MUST provide:

1. Global TODO completion summary.
2. Per-phase gate summary table.
3. Final Audit #1 report.
4. Final Audit #2 report.
5. Any extra audit(s) after fixes.
6. Binding-spec change log — files updated, sections changed, versions
   bumped.
7. Residual risks (if any).
8. Done Criteria checklist (pass/fail).
9. **Manual-smoke instruction list (added 2026-05-01).** A bulleted
   list of the *user actions* the user should manually perform to
   verify the user-visible behaviors in the plan's §1.5.1 walkthrough
   table. One bullet per row; each bullet names the exact action
   sequence + the visible result the user should see. This is the
   user's verification ritual — they can reproduce it without
   reading the plan or the diff. Lesson source: M1.3 DI pipeline
   overhaul Phase 5 claimed "GO" with all gates green, but the user
   immediately reported "B7 doesn't work at all" because the
   manual-smoke gap (rubber-band ignores locks) was never on the
   verification checklist. Including this list in the handoff lets
   the user run a 60-second sanity pass before trusting the GO.

---

## 3.6) Quality Bar

- No laziness, no skipped checks, no implied pass.
- MUST prefer explicit evidence over narrative claims.
- If uncertain, MUST verify with a command/test and report output.

---

## 3.7) Plan Save and Cleanup

- The approved plan lives at `docs/plans/<branch-name>.md` (see
  Procedure 01 §1.10).
- Before starting execution, MUST delete any previous versioned plan
  files for the same topic (e.g. `*-v1.md`, `*-v2.md`, `*-draft.md`).
  Only the single approved plan file MUST remain.
- During execution, update the approved plan in-place with any
  corrections discovered (add a "Post-execution notes" section at the
  bottom — do not create new files).

---

## 3.8) Post-Execution Handoff (mandatory — output in chat after final commit)

After all phases are complete, all audits are green, and commit(s) are
created, MUST output this handoff block **in chat**:

```
---
## Post-Execution Handoff

**Plan:** `docs/plans/<branch-name>.md`
**Branch:** `<branch-name>`
**Commit range:** `<first-sha>..<last-sha>` (or single SHA if one commit)

### Files changed
- **Created:** <list of new files>
- **Modified:** <list of modified files>
- **Deleted:** <list of deleted files>

### Binding specs updated
- <path>: <change summary, version bump if applicable>
- (or "None — implementation conformed to existing specs")

### Paste to Codex for audit
> Review the commit range above using the protocol at
> `docs/procedures/Codex/04-post-commit-review.md` (Procedure 04).
> If the review finds issues requiring fixes, hand back to Claude for
> remediation per `docs/procedures/Claude/05-post-commit-remediation.md`.
```

Rules:
- MUST populate all fields with real values (no placeholders).
- Commit SHAs MUST be actual short SHAs from `git log`.
- File lists MUST be complete (use `git diff --name-status` against the
  base).
- MUST push before outputting this block.

---

## 3.9) Post-Commit Self-Review Loop (mandatory)

After commit(s) are pushed and before outputting the handoff block in
§3.8, MUST perform a self-review and remediation cycle:

1. **Self-Review:** Run Procedure 04 (Post-Commit Review) against the
   commit range, treating own code as if written by another author.
   Classify all findings as Blocker / High-risk / Quality gap.
2. **Remediation:** If any findings are Blocker or High-risk, fix them
   immediately per Procedure 05 (Post-Commit Remediation). Commit and
   push the fixes.
3. **Re-Review:** After each remediation commit, re-run the full
   Procedure 04 review against the updated commit range.
4. **Repeat** steps 2-3 until a review round produces **zero Blocker
   and zero High-risk findings**.
5. Quality-gap findings MAY be deferred if cosmetic and not affecting
   correctness, safety, or architecture compliance — but MUST be listed
   as residual risks in the handoff.

**Hard rules:**
- MUST NOT output the §3.8 handoff block until the self-review loop
  terminates with zero Blocker / High-risk findings.
- Each remediation commit MUST be a separate commit (not amend).
- The final handoff commit range MUST include all remediation commits.
- If a remediation introduces new findings, the loop continues — no cap
  on iterations.

---

## 3.10) Mid-Execution Deviation

If during execution you discover that the approved plan is wrong or
incomplete:

- MUST stop.
- MUST NOT silently deviate from the plan.
- MUST output the discovered issue in chat with a proposed plan patch.
- MUST wait for user acknowledgment before proceeding.

If the discovered issue requires changing a binding specification:

- MUST follow the Approved Deviation Protocol
  (00-architecture-contract.md §0.7).
- This typically means pausing execution, updating the plan to include
  the deviation, obtaining user approval, and only then resuming.

Silent deviations discovered in post-commit review = **Blocker** and
will trigger rework.
