# Procedure 05 — Post-Commit Remediation

> **RFC 2119 convention**: "MUST", "MUST NOT", "SHALL", "SHOULD", and "MAY"
> carry their standard meanings throughout this document.

---

## Prerequisite

Before starting, MUST have read
`docs/procedures/Claude/00-architecture-contract.md` and the Procedure 04
audit memo that triggered this remediation.

---

## 5.0) Trigger

Use **after a commit exists** to catch and fix missed items identified by
Procedure 04 (Post-Commit Review) — either Claude's self-review loop
(§3.9) or a Codex review.

---

## 5.1) Operating Contract

1. MUST start from the current review round (infer from thread if not
   given).
2. MUST audit **all files touched in the target commit range**, plus any
   files the review memo cites.
3. MUST classify findings: Blockers / High-risk / Quality gaps.
4. MUST fix findings in priority order (Blockers first).
5. MUST re-run audits and gates until clean.
6. MUST push after each commit. MUST NOT wait for handoff block before
   pushing.

---

## 5.2) Required Output Structure (every round)

1. Round Header
2. Classification Summary
3. Architecture Compliance (GR-1/GR-2/GR-3)
4. ADR-by-ADR verification against committed changes
5. Deep Audit Findings
6. Per-file Review Summary
7. Delta vs Previous Round (Resolved / Open / Regressed / Review Miss)
8. **Binding-spec impact check** — confirm docs are current or list
   needed updates
9. Done Criteria Checklist
10. Final Rating
11. Go / No-Go

---

## 5.3) Remediation Workflow (MUST execute in order)

### Phase 0 — Scope lock

- MUST identify target commit range and touched files.
- MUST publish per-file checklist.
- MUST read the review memo that triggered this remediation. Every
  Blocker and High-risk item from the memo must be addressed.

### Phase 1 — Full post-commit audit

- MUST apply strict evidence mode.
- MUST record findings with file/line evidence and validation commands.

### Phase 2 — Fix pass

- MUST implement fixes for Blockers, then High-risk, then Quality gaps.
- MUST keep changes minimal and architecture-consistent.
- If fixes change behaviour described in any binding spec (ADR, registry
  entry, glossary, design tokens), MUST update the relevant doc(s) in
  the same commit as the code change.
- If a fix would require deviating from a binding spec, MUST stop and
  follow the Approved Deviation Protocol
  (00-architecture-contract.md §0.7) before proceeding.

### Phase 3 — Validation gates

MUST run mandatory gates before proceeding:

- Grep / routing / dead-code gates (MUST return zero results where
  applicable).
- Targeted tests for touched behaviour.
- Lint / type checks if relevant to changed scope.

### Phase 4 — Re-audit after fixes

- MUST re-run full audit and update item statuses.
- If any new issues found, MUST return to Phase 2.

### Phase 5 — Final audit loop (minimum two)

- Final Audit #1 (full).
- Final Audit #2 (independent re-check).
- If any fix is made after either final audit, MUST run another full
  audit.

---

## 5.4) Mandatory Completion Gates

A remediation round is complete only when ALL pass:

1. No open Blockers.
2. Every High-risk item is either fixed or explicitly risk-accepted with
   rationale.
3. Done Criteria checklist is fully pass/fail marked.
4. Per-file coverage statement confirms all touched files were reviewed.
5. All required commands / tests shown with pass/fail results.
6. **Binding specs are confirmed current** — no stale references to
   changed behaviour; version bumps applied where required.

---

## 5.5) Evidence Rules

- MUST NOT use "looks fine" claims without command or code evidence.
- For each resolved item, MUST include:
  - what changed
  - where changed (file:line)
  - how verified (command or test output)

---

## 5.6) Plan Update After Remediation

- The approved plan lives at `docs/plans/<branch-name>.md`.
- After each remediation round, MUST update the approved plan file to
  reflect what was fixed.
- Add a dated "Post-commit remediation" section at the bottom of the
  plan with:
  - What was found (Blocker / High-risk / Quality gap)
  - What was changed (file + description)
  - How it was verified (gate command + result)
  - Any binding-spec updates made (path + version bump)
- If multiple remediation rounds occur, MUST keep appending — do not
  overwrite previous remediation entries.
- The plan file MUST always reflect the true final state of the
  implementation.

---

## Plan File Lifecycle

The approved plan at `docs/plans/<branch-name>.md` accumulates notes
through the lifecycle:

1. **During execution** (Procedure 03): Add "Post-execution notes"
   section for any plan corrections discovered while coding.
2. **During remediation** (this procedure, §5.6): Add dated "Post-commit
   remediation" sections for each fix round.

These are SEPARATE sections appended chronologically. The plan file MUST
always reflect the true final state.

---

## Handoff to Other Procedures

- **If remediation discovers issues requiring plan revision:** hand off
  to Procedure 02 (Plan Review) for scrutiny, then revise the plan per
  Procedure 02's scrutiny response protocol before continuing
  remediation.
- **If remediation produces a read-only audit memo (no fixes):** use
  Procedure 04 (Post-Commit Review) instead of this procedure.
- **If a fix would require deviating from a binding spec:** pause
  remediation, follow the Approved Deviation Protocol
  (00-architecture-contract.md §0.7), obtain user approval, then resume.

---

## 5.7) Remediation Handoff (mandatory — output in chat after remediation is complete)

After remediation is complete and commit(s) are created, MUST do two
things:

### A) Ensure reviewer block in plan file

When remediation updates the plan file (`docs/plans/<branch-name>.md`),
the plan MUST still end with the reviewer handoff block (Procedure 01
§1.11 Part A). If the block is already present, leave it. If missing,
append it.

### B) Output pastable handoff block in chat

MUST output this exact structure in chat (filling in actual values):

```
---
## Remediation Review Handoff

**Plan:** `docs/plans/<branch-name>.md`
**Branch:** `<branch-name>`
**Commit range:** `<first-sha>..<last-sha>` (or single SHA if one commit)
**Status:** Remediation complete — ready for review

### Files changed
- **Created:** <list of new files>
- **Modified:** <list of modified files>
- **Deleted:** <list of deleted files>

### Binding specs updated
- <path>: <change summary, version bump if applicable>
- (or "None — remediation conformed to existing specs")

### Paste to Codex for review
> Review the commit range above using the protocol at
> `docs/procedures/Codex/04-post-commit-review.md` (Procedure 04).
> If the review finds further issues, hand back to Claude for another
> remediation round per
> `docs/procedures/Claude/05-post-commit-remediation.md`.
```

Rules:
- MUST populate all fields with real values (no placeholders).
- Commit SHAs MUST be actual short SHAs from `git log`.
- File lists MUST be complete (use `git diff --name-status` against the
  base).
- MUST push before outputting this block.
