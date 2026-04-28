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

### 1.4.1) Plan-vs-Code Grounding (mandatory — added 2026-04-28 after M1.3 Round 6 deviation discovery)

Every plan-text claim that references a specific code construct MUST be
grounded by reading the actual file at plan-authoring time. "Investigate
the codebase" is NOT satisfied by greps alone — when the plan describes
code SHAPES, the author MUST have read enough of the file to confirm the
shape matches reality.

**Constructs requiring file-read grounding:**

- **Class declarations and class-shape claims.** If the plan says "extend
  `class X` with methods M1 / M2 / M3" or "the runner is a class with
  state-machine methods", the author MUST have read the file and confirmed
  the class declaration exists in that form. A function that exports a
  factory returning an interface is NOT a class, even if it conceptually
  serves the same role.
- **Function signatures.** If the plan says "modify `functionY(a, b, c)`"
  or "the existing helper takes `(manifest, buffers, anchor)`", the author
  MUST have read the function's actual signature.
- **Public API surfaces.** If the plan claims a module exposes specific
  public methods or types (e.g. "the runner exposes `publishPrompt` /
  `advanceGenerator` / `dispatchInput`"), the author MUST have read the
  module's exports and confirmed those names exist.
- **File paths and line numbers.** If the plan cites a specific file path
  or line number ("the click-eat guard at `EditorRoot.tsx:533`"), the
  author MUST have read that file and confirmed the line is reasonable
  (off-by-a-few is acceptable; off-by-handler-name is not).
- **Architectural patterns.** If the plan claims "the existing pattern
  is X" or "tools already do Y per cursor-tick", the author MUST have
  read enough of the relevant code to confirm X / Y is the established
  pattern, not an assumed one.

**Failure mode this prevents:** plan text that LOOKS internally
consistent and survives multi-round reviewer scrutiny, but specifies an
architecture that does not match the actual codebase. When execution
begins, the implementer discovers the mismatch and must either deviate
silently (forbidden per Procedure 03 §3.10), apply a §3.10 mid-execution
patch (possible but expensive after multiple review rounds), or pause
the round entirely. The cost of skipping plan-vs-code grounding compounds
through every subsequent review round — Codex polishes plan text that
will not survive contact with the actual code.

**Lesson source:** M1.3 Round 6 (DI pill redesign) reached Codex Go at
9.8/10 after 6 review rounds, then on starting execution was found to
specify a class-based `ToolRunner` with `STATE_MACHINE_ADVANCE_METHODS`
SSOT array. The actual `tools/runner.ts` is function-based
(`startTool(toolId, factory): RunningTool`) with a single external
state-advance entrypoint (`feedInput`). Six rounds of review never
caught this because Codex was checking internal plan consistency, not
plan-vs-code grounding. Substantial Rev-5 H machinery (SSOT array +
helper + parameterized tests + exhaustiveness count gate) was
over-engineered for an architecture that does not exist.

**Pre-emit grounding checklist** — before §1.13 emission, the author
MUST run this check internally and include the results in the §1.13
pre-response notification (see §1.13 below):

For each plan claim that names a specific class / function / file path
/ line / architectural pattern:
1. **Did I read the file at plan-authoring time?** Yes / No.
2. **Did the actual code match the plan claim?** Match / Mismatch /
   Partial-match-with-implementation-tactic-deferral.
3. **If mismatch:** revise the plan text to match the code, OR document
   the proposed code refactor as part of the plan scope.

Skipping this checklist is a **plan-authoring procedure violation** and
materially increases the probability of a Procedure 03 §3.10
mid-execution deviation discovery.

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

For every plan that touches the project model, MUST cover:

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

If the plan does not touch the project model, state this explicitly in
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

**Plan-vs-Code Grounding Verification** (mandatory per §1.4.1 — added 2026-04-28):

| Plan claim citing a code construct | File read at authoring time? | Match status |
|------------------------------------|------------------------------|--------------|
| (e.g. "extend `class ToolRunner` with method `publishPrompt`") | Yes — `packages/.../runner.ts` lines X-Y | Match / Mismatch / Partial |
| (one row per cited construct — class / function / path / line / pattern) | | |

If any row in this table is "No" or "Mismatch", the plan MUST be revised
before §1.13 emission. The table is a forcing function for §1.4.1
discipline — the author cannot emit the notification without confronting
the grounding question for each cited construct.

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
12. Section-consistency pass: before re-emitting a revised plan that
    removes or renames a behaviour, type, file path, or artifact
    (e.g. in response to review findings), the author MUST grep the
    plan body for references to the removed/renamed concept and fix
    every stale reference in the same commit as the revision. Sections
    where stale text most commonly survives: §3 (Scope and Blast
    Radius), §4 (Binding specs touched), §10 (Invariants summary),
    §11 (Test strategy), §12 (Done Criteria), §13 (Risks), and phase
    goal-sentence headers. This check is separate from §1.3 internal
    review rounds (which verify the new content); this step verifies
    the OLD content has been removed everywhere it appears.

    **§1.16.12.a — Mandatory stale-symbol purge grep (added 2026-04-28
    after M1.3 Round 7 Codex finding).** When a revision REMOVES or
    RENAMES a specific named symbol (function name, class name, type
    name, file path, identifier, gate name), the author MUST run a
    literal-string grep for every removed/renamed symbol against the
    entire plan file and address every match before commit. Specifically:
    1. Build a list of removed-or-renamed symbols introduced by this
       revision (e.g. `handleCanvasMouseDown`, `handleCanvasMouseUp`,
       `STATE_MACHINE_ADVANCE_METHODS`, `publishPrompt`,
       `advanceGenerator`, `dispatchInput`, `assertNotInSyncBootstrap`
       for Rev-6 of M1.3 Round 6).
    2. For each symbol, run `rg -n "<symbol>" docs/plans/<branch>.md`.
    3. For each match, classify into one of three buckets:
       - **(a) Stale active reference** in a normative section (Phase
         steps, scope tables, gates, test specs, Done Criteria, risk
         table, audit C-points without explicit historical framing) →
         REWRITE to current symbol name or remove. **MUST fix.**
       - **(b) Intentional historical narrative** (revision history
         rows, post-execution notes, Codex paste block describing
         "previous Rev-N said X"; passages that explicitly frame the
         old symbol as old, e.g. "was incorrectly named X" or "Rev-N
         specified Y based on a misread") → KEEP as-is.
       - **(c) Borderline cases** (e.g. an audit C-point describing
         the OLD design as the *fix-context*) → KEEP if surrounding
         sentence makes the historical role explicit; rewrite if not.
    4. Document the grep results + bucket classification in the §1.13
       pre-response notification's "Plan-vs-Code Grounding Verification"
       table (or a sibling "Stale-Symbol Purge" table) so the user
       sees the sweep was actually performed.
    5. **Failure mode this prevents:** partial revision where the
       core flow steps get rewritten but Done Criteria, scope tables,
       risk rows, audit C-points, and §11 test descriptions still
       reference the old symbols. Codex Round-7 of M1.3 Round 6
       caught this exact failure: 8 stale references survived Rev-6
       across §4.1 / §4.2 / §7 gates / §10 audit / §11 tests / §12
       Done Criteria / §13 risks despite Phase 1 step 12 being
       correctly rewritten. Lesson source: M1.3 Round 6 Rev-6 → Rev-7.
13. **Revisions follow the same closure discipline as initial
    authoring.** Steps 1–12 above are NOT limited to the first
    emission of a plan. Every revised emission (in response to
    Procedure 02 review findings, Procedure 04 post-commit findings,
    or mid-execution §3.10 patches) MUST also:
    - Re-run §1.3 three-round internal self-audit (Chief Architect /
      Sceptical Reader / Blast Radius personas) against the REVISED
      plan text. Reacting to review findings is not a substitute for
      independent self-audit — reviewers miss things too, and fresh
      errors can be introduced by the revision itself.
    - Emit a §1.13 pre-response notification in chat BEFORE
      committing / pushing the revised plan file. This gives the
      user a tabulated summary of what changed, what stayed, and
      whether any fresh deviations or risks were introduced during
      the revision. "I already addressed the review findings" is
      not sufficient justification to skip this step.
    - Complete step 12 section-consistency pass.
    Skipping any of the above on a revision is a **procedure
    violation** and reduces the probability that the next review
    round reaches Go. The absence of §1.3 + §1.13 rigour on
    revisions is a leading indicator of Review Misses slipping past
    into post-commit audit.
