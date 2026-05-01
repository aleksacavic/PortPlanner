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
- Plan is read from `docs/plans/<branch-name>.md` on the feature
  branch pushed to `origin` (per Claude Procedure 01 §1.10). An
  uncommitted plan cannot be reviewed — hand back to the plan author
  if missing.
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
15. **User-visible behavior walkthrough check (added 2026-05-01)**:
    if the plan ships any user-observable behavior change (UI, chrome,
    painter, interactive tool, hotkey, gesture), it MUST contain a
    populated §1.5.1 User-Visible Behavior Walkthrough table per
    Claude Procedure 01 §1.5.1. Verify:
    - Each row has a non-empty "Implementation site" column pointing
      to a file:line OR a planned-new file. Empty / hand-wavy sites
      are a Blocker.
    - Each row's "Test that observes it" column references a test
      that exercises the **observable** path (chrome render, painter
      output, store-mutation-after-event), not just commit-time math.
      Tests that exercise only commit-time semantics while the
      visible row is mid-action behavior do NOT count.
    - The set of rows is **complete**: walk the request prose and
      enumerate every distinct user action the plan promises; each
      action MUST have a row.
    Lesson source: M1.3 DI pipeline overhaul Phase 3 reached Codex
    Round-4 Go 9.8/10 with a populated supported-pair-matrix but no
    user-visible-behavior walkthrough. The plan covered commit-time
    combiner correctness; the draft-time visible behavior (rubber-band
    freezes on Tab) was never wired, requiring two follow-up phases
    after user manual smoke caught the gap. A required walkthrough
    table would have surfaced rows with no implementation site at
    plan-review time.
16. **Gate-regex anchoring check (added 2026-05-01)**: per Claude
    Procedure 01 §1.8.1, every grep gate with "exactly N matches" or
    "zero matches in src" expected output MUST be anchored to
    declarative sites (`^\s*<symbol>:` for fields, `^\s*function
    <name>` for functions, etc.). Un-anchored regexes (`rg "<symbol>"`
    by itself) trip on JSDoc + body reads + test scaffolding,
    requiring §3.10 mid-execution patches that erode plan integrity.
    Verify each gate's regex would match ONLY the declarative sites
    its prose describes when run against the expected post-execution
    file. Lesson source: M1.3 DI pipeline overhaul Phases 1, 3, 4
    each required a §3.10 gate-regex patch for the same un-anchored
    pattern.
17. What are the gaps?
18. Final rating (1-10) + Go/No-Go.

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

- **Plan-vs-Code Grounding (mandatory — added 2026-04-28 after M1.3
  Round 6 deviation discovery).** For every plan-text claim that
  references a specific code construct (class declaration, function
  signature, public API surface, file path, line number, architectural
  pattern), Codex MUST verify the claim by reading the referenced file
  and confirming the construct exists in the form the plan claims.
  - **Trigger sentences to grep for in the plan:** "class X", "method
    Y", "the runner exposes ...", "the existing pattern is ...", "tools
    already ...", file paths with line numbers (e.g. `path/to/file.ts:NN`),
    pseudocode blocks claiming a specific code shape.
  - **For each cited construct:** open the file, locate the construct,
    confirm name + shape + location match the plan claim. If the plan
    cites a class but the file exports a factory function, that's a
    **High-risk** finding regardless of internal plan consistency.
  - **Output:** the §2.9 review memo MUST include a "Plan-vs-Code
    Grounding Verification" table (per §2.9 item 5b below) listing
    every cited construct + whether it matches reality + the file:line
    evidence.
  - **Failure mode this prevents:** plan text that survives multiple
    review rounds on the strength of internal logical consistency but
    specifies code constructs that do not exist. M1.3 Round 6 reached
    Go at 9.8/10 after 6 rounds of review, then on starting execution
    Claude discovered the plan's `class ToolRunner` with
    `STATE_MACHINE_ADVANCE_METHODS` SSOT array did not match the
    actual function-based `startTool(toolId, factory): RunningTool`
    runner. Codex's prior rounds did not catch this because Codex was
    checking plan internal consistency, not plan-vs-code grounding.
    The discovery cost a Procedure 03 §3.10 mid-execution patch round
    after the plan was approved — work that would have been a single
    Round-1 finding had Codex verified the construct against the
    actual runner.ts.
  - **Codex-specific posture:** when the plan author claims "I read
    the file and verified the shape matches", Codex MUST still verify
    independently. The §1.13 plan-vs-code grounding table the author
    emits is a forcing function for the author, not an alternative
    to Codex's verification.
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
- **Smoke / E2E test scope (UI milestones).** When the plan produces a
  runnable user-facing artifact (a React component root, a CLI, a
  service endpoint), smoke / E2E gates MUST exercise the artifact at
  the user-facing boundary:
    - For React UI: tests MUST `render(<PublicRoot />)` (or equivalent
      mount of the public component root) and fire DOM events
      (`fireEvent.keyDown`, `fireEvent.pointerDown`, `fireEvent.click`,
      etc.). Action-API assertions (calling reducers / store actions
      directly) are unit-level coverage and DO NOT satisfy a smoke
      gate. Reviewers MUST flag any plan whose Done Criteria pairs
      user-flow language ("user presses X, sees Y") with action-API
      tests.
    - For CLI: tests MUST `spawn` the binary and assert stdout / exit
      code. Calling the CLI's library entry-point directly is
      unit-level.
    - For service endpoint: tests MUST issue an HTTP request and
      assert the response. Calling the route handler in-process is
      unit-level.
  Lesson source: M1.3a Codex post-commit Round-1 (audit of
  `c9784a6..4fb4e5c`) returned no spec/code findings yet the milestone
  failed user acceptance because Phase 21 smoke scenarios called
  `addPrimitive(...)` instead of mounting `<EditorRoot />` and firing
  DOM events. Three plan-review rounds + the post-commit audit all
  missed the gap because Procedure 02 had no equivalent of this rule.
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
5b. **Plan-vs-Code Grounding Verification** (mandatory per §2.4 — added 2026-04-28). Table of cited code constructs with Match / Mismatch / Partial status + file:line evidence. Mismatches are High-risk findings.
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

### Mandatory revision-discipline reminder (every handback memo)

Every Codex handback memo that produces Blockers or High-risk items
MUST close with an explicit reminder directing Claude to re-read the
revision-discipline rules before responding. The reminder is NOT
optional; its absence is a procedure miss on the reviewer side and
reduces the probability of reaching Go in the next round.

Reminder template (copy into the handback memo verbatim or paraphrase
while preserving every point):

> **Before revising the plan in response to these findings, Claude
> MUST:**
>
> 1. Re-read Procedure 01 §1.3 (Three internal review rounds —
>    Chief Architect / Sceptical Reader / Blast Radius) and run the
>    self-audit on the REVISED plan text, not just on the original.
> 2. Re-read Procedure 01 §1.13 (Pre-response notification) and
>    emit the tabulated notification in chat BEFORE committing and
>    pushing the revised plan file. The user must see the
>    notification before wading through the revised plan.
> 3. Re-read Procedure 01 §1.16 step 12 (Section-consistency pass)
>    and grep the plan body for references to any removed or
>    renamed concept after the revision.
> 4. Re-read Procedure 01 §1.16 step 13 (Revisions follow the same
>    closure discipline as initial authoring) — confirming that
>    §1.3 + §1.13 + §1.16 step 12 all apply to revised emissions,
>    not only to the first authoring.
> 5. Re-read Procedure 02 §2.10 (Scrutiny Response Protocol) and
>    append the Appendix — Scrutiny Assessment and Actions
>    section to the plan file with per-finding Decision /
>    Rationale / Plan-updates entries.
>
> Reacting to review findings is not a substitute for independent
> self-audit. Reviewers miss things; revisions can introduce fresh
> errors. The ceremony above exists to catch both before the next
> review round.

### Reviewer self-check

Before emitting the handback memo, Codex MUST verify:

- The reminder above appears at the end of the memo (or its
  equivalent in the reviewer's own words covering every point).
- The reminder references the specific procedure sections by
  number, not just topic.

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
