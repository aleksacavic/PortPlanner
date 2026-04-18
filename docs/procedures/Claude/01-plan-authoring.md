# Procedure 01 — Plan Authoring (PLAN-ONLY Mode)

> **RFC 2119 convention**: "MUST", "MUST NOT", "SHALL", "SHOULD", and "MAY"
> carry their standard meanings throughout this document.

---

## Prerequisite

Before starting, MUST have read
`docs/procedures/Claude/00-architecture-contract.md`. This procedure
assumes knowledge of binding specifications, Ground Rules (GR-1/2/3), and
the Approved Deviation Protocol.

---

## 1.1) Operating Mode

This is a **plan authoring task only**.

- MUST NOT write code.
- MUST NOT modify source files.
- MUST NOT commit source-code or binding-spec changes.
- MUST commit the plan file itself to the feature branch and push it
  to `origin` (see §1.10). An uncommitted plan is invisible to
  reviewers running in separate sessions (Codex, other Claude
  instances, remote humans).
- Output is the plan file at `docs/plans/<branch-name>.md` (committed
  and pushed) plus the pre-response notification in chat.

The user will explicitly say "execute" or invoke Procedure 03 before any
implementation begins.

---

## 1.2) Planner Operating Contract

When given a request, MUST NOT begin writing a plan immediately.

Before writing:

1. **Restate the request** in your own words. Confirm understanding.
2. **Name explicit assumptions.** If the request has ambiguity, list the
   interpretations and ask which one applies. Do not pick silently.
3. **Identify the scope boundary.** What is in scope? What is explicitly
   out of scope? What is ambiguously on the edge?
4. **Identify binding specifications touched.** Which ADRs, registry
   entries, glossary terms, design tokens, or coordinate system aspects
   are relevant? Read them. Cite them.
5. **Identify potential deviations.** If the request requires changing
   behaviour described in a binding spec, flag it now. A deviation
   requires the Approved Deviation Protocol (00-architecture-contract.md
   §0.7).

Only after these five steps produce a clear picture may the plan begin.

---

## 1.3) The Self-Auditing Planner (Three-Round Internal Review)

Before emitting the plan to the user, perform **three internal review
rounds** on the draft plan, adopting an adversarial reviewer persona.

### Round 1 — Chief Architect scrutiny

Adopt the posture of a senior port planning platform architect who has
read every ADR and extraction registry entry. Ask:

- Does this plan violate any ADR? Cite ADR IDs.
- Does this plan introduce a new object type without a registry entry?
- Does this plan do geometric math in anything other than project-local
  metric coordinates (ADR-001 violation)?
- Does this plan bypass the extraction contract (ADR-004 violation)?
- Does this plan couple layout state to analysis/cost state on the same
  object (ADR-002 violation)?
- Does this plan treat generated objects as AUTHORED or vice versa
  (ADR-003 violation)?
- Does this plan store 3D meshes in the database (ADR-008 violation)?
- Does this plan ship validation as a post-hoc audit rather than a
  derivation-pipeline step (ADR-007 violation)?
- Does this plan assume real-time collaboration from day one (ADR-010
  scope violation)?
- Does this plan violate module isolation (GR-3)?

Mark every concern as Blocker / High-risk / Quality gap.

### Round 2 — Sceptical reader scrutiny

Adopt the posture of a developer who has never seen the request, only
the plan. Ask:

- Is the scope boundary clear?
- Are the invariants stated explicitly with enforcement gates?
- Does each phase have verifiable completion gates?
- Could a developer read this and implement it without guessing?
- Are the success criteria testable?
- Is there anything hand-waved?

### Round 3 — Blast radius scrutiny

Ask:

- What breaks if this plan is wrong?
- What files and packages are touched?
- What downstream consumers depend on the changed behaviour?
- Is there a scenario-level impact (ADR-006)?
- Is there a library-level impact (ADR-005)?
- Does this change affect stored data that requires migration?

After all three rounds, revise the plan to address every concern before
emitting.

---

## 1.4) Investigation Depth

Before writing the plan, investigate the codebase. Do not guess.

- `rg -n "<identifier>"` to find all references to a function, type, or
  constant you intend to modify.
- Read the actual source of every function you intend to call.
- Read the binding spec document(s) for every object type or ADR you
  intend to touch.
- If a field name or API shape is mentioned in the request, grep to
  confirm it exists in the codebase before writing against it.
- If you are uncertain whether a file or function exists, verify with
  a command — do not proceed on assumption.

Claims in the plan MUST cite concrete proof. "According to ADR-004
§..." or "see `packages/domain/src/extractors/rtg-block.ts` line X" is
acceptable. "Probably" or "should be" is not.

---

## 1.5) Scope + Blast Radius (mandatory section in plan)

Every plan MUST have an explicit "Scope and Blast Radius" section
containing:

### In scope

- Specific files to be created
- Specific files to be modified
- Specific new object types, extractors, validation rules, or UI
  components being added

### Out of scope

- Items that look adjacent but are explicitly not being done in this plan
- Reasons for deferral where useful

### Blast radius

- Packages affected
- Other object types affected via cross-object extractors
- Scenarios affected
- Stored data affected (if any)
- UI surfaces affected

### Binding specifications touched

- List of ADRs referenced
- List of registry entries modified or added
- List of glossary terms added or clarified
- Design tokens added or modified

---

## 1.6) Architecture Doc Impact (mandatory section in plan)

Every plan MUST explicitly list which binding specifications will be
updated as part of execution.

| Doc | Path | Change type | Reason |
|-----|------|-------------|--------|
| (example) ADR-003 | `docs/adr/003-ownership-states.md` | No change | Implementation conforms |
| (example) Registry RTG_BLOCK | `docs/extraction-registry/RTG_BLOCK.md` | Version bump 1.0.0 → 1.0.1 | Bug fix in clearance_height formula |
| (example) Glossary | `docs/glossary.md` | Add term | New concept: "host space regeneration" |

If a deviation is being proposed, this table MUST include the new
superseding ADR or the updated registry entry. Follow the Approved
Deviation Protocol in 00-architecture-contract.md §0.7.

---

## 1.7) Object Model and Extraction Integration

If the plan adds or modifies any object type, MUST explicitly cover:

- Object contract compliance (ADR-002): typed core fields vs JSONB
  parameters, ownership state field, library traceability fields.
- Extraction contract: QuantityExtractor signature, inputs, outputs,
  version. Matches registry entry exactly.
- Validation rules: scope (OBJECT/RELATIONSHIP/PROJECT), severity,
  condition, and the registry entry that declares them.
- Mesh descriptor generation (ADR-008): if 3D rendering is in scope,
  the fingerprint inputs and what triggers invalidation.
- Document sync integration (ADR-010): operation types emitted on
  create/update/delete of this object, before/after snapshot shapes.
- Ownership semantics (ADR-003): which states this object can be in,
  how state transitions happen.

These are not optional sections. Either the plan addresses all of them,
or it justifies in a dedicated "Not applicable" subsection why a given
item does not apply.

---

## 1.8) Invariants and Enforcement Gates

Every invariant the plan introduces or depends on MUST have an
enforcement mechanism. No policy without enforcement.

### Acceptable enforcement types

- **grep gates**: `rg -n "<pattern>" <path>` with expected match count
- **unit tests**: specific test files with specific assertions
- **type checks**: TypeScript types that make the invariant unreachable
- **runtime assertions**: for invariants that cannot be enforced
  statically, an `assert` at a named site with a named error

### Example

> Invariant: every RTG_BLOCK object must have a `classification` field
> set to a member of `RTGBlockClassification`.
>
> Enforcement:
> - TypeScript type on `classification` field is the union enum.
> - Unit test `rtg-block.test.ts:testClassificationRequired` asserts
>   creation fails when field is absent.
> - Grep gate: `rg -n "RTG_BLOCK" packages/domain/src/extractors/ | rg -v "classification"` MUST return zero results.

Claims such as "we will ensure X" without an enforcement mechanism are
not acceptable.

---

## 1.9) Hydration, Serialization, Undo/Redo, Sync

For every plan that touches the document model, MUST cover:

### Hydration (document load path)

- How are loaded objects validated?
- What happens to objects with unknown types or fields?
- How are library snapshots resolved during load?

### Serialization (document save path)

- What fields are written?
- What is derived and NOT written (see ADR-002: analysis bindings, cost
  bindings, mesh descriptors are not on the object)?
- What is the scenario_id behaviour (ADR-006)?

### Undo/Redo (operation log)

- What OperationType is emitted for each mutation?
- What is the before/after snapshot shape?
- How is the operation replayed during undo?
- How is the operation replayed during redo?

### Sync (ADR-010)

- If two users edit the same object, what is the expected conflict
  behaviour?
- What happens on reconnect with a backlog of operations?

If the plan does not touch the document model, state this explicitly in
a "Not applicable" subsection with the reason.

---

## 1.10) Plan File Location and Single-Plan Rule

The approved plan lives at `docs/plans/<branch-name>.md`.

- Branch naming: `<category>/<short-descriptor>` e.g. `feature/rtg-block-extractor`, `fix/fillet-radius-zero`, `refactor/object-model-split`.
- Plan filename: matches the branch. `docs/plans/feature/rtg-block-extractor.md`.
- The plan file MUST be committed to the feature branch and pushed to
  `origin` as part of plan-authoring closure (§1.16). Commit message
  convention: `docs: author <plan-title> plan`. No PR is required at
  this stage — reviewers pull the branch directly. PRs are opened only
  after plan review + approval, typically at the point implementation
  begins (Procedure 03).
- Before starting execution (Procedure 03), any previous versioned drafts
  MUST be deleted. Examples:
  - `docs/plans/feature/rtg-block-extractor-v1.md` → delete.
  - `docs/plans/feature/rtg-block-extractor-draft.md` → delete.
  - Only the single approved file MUST remain.

---

## 1.11) Plan file structure (mandatory)

Every plan file MUST contain these sections in order:

1. **Title and branch**
2. **Request summary** (user's original ask, restated)
3. **Assumptions and scope clarifications**
4. **Scope and Blast Radius** (§1.5)
5. **Binding specifications touched** (§1.5)
6. **Architecture Doc Impact** (§1.6 table)
7. **Deviations from binding specs** (if any; follow §0.7 Approved
   Deviation Protocol)
8. **Object Model and Extraction Integration** (§1.7) — or "Not applicable"
9. **Hydration, Serialization, Undo/Redo, Sync** (§1.9) — or "Not applicable"
10. **Implementation phases**
    - Each phase has:
      - Phase Goal
      - Files affected
      - Steps
      - Invariants introduced (with enforcement per §1.8)
      - Mandatory Completion Gates (§1.12)
      - Tests added
11. **Invariants summary** — consolidated list with enforcement references
12. **Test strategy** — what tests exist before, what will be added
13. **Done Criteria** — objective pass/fail checklist
14. **Reviewer handoff block** (Part A below)

### Part A — Reviewer handoff block (MUST be the final section)

```
---
## Plan Review Handoff

**Plan:** `docs/plans/<branch-name>.md`
**Branch:** `<branch-name>`
**Status:** Plan authored — awaiting review

### Paste to Codex for plan review
> Review this plan using the protocol at
> `docs/procedures/Codex/02-plan-review.md` (Procedure 02).
> Apply strict evidence mode. Start from Round 1.
```

The block MUST be present before the plan is considered ready. Do not
truncate it.

---

## 1.12) Mandatory Completion Gates per phase

Each implementation phase MUST include at least one objective, command-based
gate that determines whether the phase is complete.

Gate rules:
- Prefer "MUST return zero results" for removals or migrations.
- Use exact command syntax.
- Define expected output for non-grep gates.
- No phase is complete until all its gates pass.

Example gates:

```
Gate 1: Grep for old API usage
  Command: rg -n "oldExtractorCall\(" packages/
  Expected: zero matches

Gate 2: Unit tests pass
  Command: pnpm test packages/domain/src/extractors/rtg-block.test.ts
  Expected: all tests pass, no skipped

Gate 3: Type check
  Command: pnpm tsc --noEmit
  Expected: zero errors
```

---

## 1.13) Pre-Response Notification (mandatory)

After the plan is complete but **before emitting the full plan file**,
MUST output a concise tabulated notification in chat. This lets the user
intervene before wading through a long plan.

### Required tables

**Request understanding:**

| Item | Status |
|------|--------|
| Request restated | (one-line summary) |
| Assumptions made | (list or "none") |
| Ambiguities flagged | (list or "none") |

**Scope boundary:**

| In scope | Out of scope |
|----------|--------------|
| (summary) | (summary) |

**Binding specs touched:**

| Spec | Change type |
|------|-------------|
| (ADR/registry entry) | (no change / version bump / new / superseded) |

**Deviations proposed** (critical — user MUST approve):

| # | Deviation | Binding spec affected | Reason | User approval required? |
|---|-----------|----------------------|--------|------------------------|
| (only populated if §0.7 deviations exist) |

**Risks identified in self-review:**

| Risk | Mitigation in plan |
|------|---------------------|
| (summary) | (summary) |

### Rules

- MUST be output in chat only, not in the plan file.
- MUST include every deviation with explicit user approval prompt.
- MUST wait for user acknowledgment before emitting the full plan file.
- If the user approves, emit the full plan file at the path specified
  in §1.10.
- If the user rejects or requests changes, revise the plan and re-run
  §1.3 internal review before re-notifying.

---

## 1.14) Branch Discipline

- Before plan authoring begins, MUST verify the correct branch is
  checked out. Plan is written against the branch it will be executed on.
- Branch name matches plan file name per §1.10.
- If the user has not created a branch, the plan MUST begin by creating
  one: `git checkout -b <category>/<short-descriptor>`.
- If the user is on `main`, ask before proceeding — plans should not be
  authored against `main` directly.

---

## 1.15) Quality Bar

- No laziness, no skipped checks, no implied pass.
- MUST prefer explicit evidence over narrative claims.
- If uncertain, verify with a command and report output.
- Plans with unenforced invariants, missing gates, or hand-waved scope
  MUST be revised before emitting.

---

## 1.16) Closure

Plan authoring is complete only when:

1. All §1.2 pre-planning steps done.
2. Three internal review rounds per §1.3 complete.
3. Plan file structure per §1.11 satisfied including all sections.
4. Every phase has mandatory completion gates per §1.12.
5. Every invariant has enforcement per §1.8.
6. Any deviation has followed §0.7 Approved Deviation Protocol.
7. Pre-response notification per §1.13 output and user has acknowledged.
8. Plan file written at `docs/plans/<branch-name>.md`.
9. Reviewer handoff block (§1.11 Part A) present at the end of the plan.
10. No versioned drafts remain per §1.10.
11. Plan file committed to the feature branch and pushed to `origin`
    per §1.1 and §1.10. Reviewers cannot see an uncommitted plan.
