# Plan — M1.3 DI pipeline overhaul (B6 live cursor + B7 Tab lock & inversion + B8 Arrow Up recall)

**Branch:** `feature/m1-3-di-pipeline-overhaul`
**Author:** Claude
**Date:** 2026-04-30

## Revision history

| Rev | Date | Trigger | Changes |
|---|---|---|---|
| 1 | 2026-04-30 | Initial draft. M1.3 Round 7 backlog items B6 + B7 + B8 land together — they share the `commandBar.dynamicInput` slice contract (dropping `placeholders[]`, adding `locked: boolean[]` and later `recallActive: boolean`), the manifest-pipeline (combiner becomes cursor-aware), and the recall map (renamed `lastSubmittedBuffers` → `dynamicInputRecall`). Splitting them would require three contract changes; bundling means one. Phase 1 establishes the contract; Phase 2 ships B6; Phase 3 ships B7; Phase 4 ships B8 and retires the Round 7 Phase 2 dim-placeholder design via clean-break per GR-1. |
| 4 | 2026-05-01 | Codex Procedure 02 Round-3 review (No-Go, 1 Partial-Agree Blocker + 1 Agree High-risk) — fixes applied: **B1 (Partial-Agree, path-role framing in §3.0)**: Codex flagged that §3.0 cited only `docs/procedures/Claude/00-architecture-contract.md` (author copy) but Procedure 02 review prerequisite expects the Codex-side mirror at `docs/procedures/Codex/00-architecture-contract.md`. Verified via `ls docs/procedures/Codex/` that the Codex-side copy exists (along with `02-plan-review.md` + `04-post-commit-review.md`); confirmed via `diff -u` that the Claude-side and Codex-side architecture contracts mirror the same binding ADR list with reviewer-role framing differences only. §3.0 split into §3.0.a "Author-role prerequisites" (Claude-side, consulted while authoring) + §3.0.b "Reviewer-role prerequisites" (Codex-side, expected by Procedure 02 review). §3.0.b explicitly lists `docs/procedures/Codex/00-architecture-contract.md` AND `docs/procedures/Codex/02-plan-review.md` (the Codex review protocol) so reviewer-role framing is explicit. **H1 (Agree, gate exactness)**: every gate row's expected-output column tightened — `≥N matches` → `exactly N matches in <file> (<rationale>)`; `exit 0` → `exit code 0; zero TypeScript errors / zero biome errors`; "all pass; net-new ≈ N" → `final test count = baseline + N (<itemized breakdown>)`. Per Codex's rule enhancement "Require each grep gate to include exact command + expected count in plan (not just intent labels)". |
| 3 | 2026-04-30 | Codex Procedure 02 Round-2 review (No-Go, 1 Blocker regression + 1 High-risk scope) — fixes applied: **B1-regress** (combiner call snippet at Phase 4 step 2 still showed 5-arg form `combineDynamicInputBuffers(..., cursorRel, locked)`): snippet rewritten to the 4-arg signature locked in A19 — `(manifest, buffers, anchor, cursor)` only, no `locked` arg. Comment expanded to source `cursor` from `editorUiStore.getState().overlay.lastKnownCursor` (matches Phase 3 step 2 wording). Stale-symbol re-sweep run (zero matches for `cursorRel, locked` and `, locked,` patterns in the plan). **H1-scope** (persistence gate scope too narrow for §8 claim): the single Rev-2 gate `DI-P4-NoDIFieldsInPersistence` was scoped to `packages/domain/src/serialize.ts` + `packages/domain/src/schemas/` only. Rev-3 expands to FOUR gates covering the full persistence surface allowlist per Codex's "explicit path list + zero-match expectations per path" rule: (a) **Domain** — same scope as Rev-2 (serialize.ts + schemas/); (b) **ProjectStore** — `packages/project-store/src/` (store.ts, actions.ts, actions/ folder, operation-emit.ts, initial-state.ts, index.ts); (c) **OperationEmit** — `editorUiStore` / `commandBar` references in operation-emit.ts + actions.ts (catches accidental editor-UI reads in undo/redo path); (d) **NoEditorUiCrossImport** — confirms `packages/domain/src` and `packages/project-store/src` do NOT import from editor-2d (architectural barrier per GR-3 / ADR-015 ensures DI fields cannot reach persistence by transitive read). Invariant I-DI-13 expanded; Done Criteria Phase 4 row references the 4-gate suite. |
| 2 | 2026-04-30 | Codex Procedure 02 Round-1 review (No-Go, 2 Blockers + 3 High-risks) — fixes applied: **B1** (Prerequisite evidence): added §3.0 "Prerequisite evidence" subsection enumerating every binding-doc + procedure file read at authoring time with timestamps, addressing Codex's "show evidence of completion of prerequisite read" gap. **B2** (A19 ↔ §4.0.2 contradiction): line 250's stale paragraph "the `locked` parameter is threaded through for symmetry" deleted (combiner has NO `locked` parameter per A19); §4.1 DynamicInputPills row's `deriveLivePillValue(guide, fieldKind)` corrected to drop the `fieldKind` arg (Phase 2 step 1 already says no `fieldKind`); §4.1 dynamic-input-combine.test.ts row's "gains `cursor` + `locked` params" corrected to "gains `cursor` param" (single param per A19); §4.1 draw-tools.test.ts polyline row's "only Distance is locked" reworded to "Distance buffer non-empty" for clarity; Rev-1 history-row "combiner becomes cursor + lock aware" reworded to "cursor-aware (single new param per A19)". **H1** (operator-shortcut version target): plan now specifies exact bump `2.1.0 → 2.2.0` (minor — adding ArrowUp/ArrowDown shortcuts) per registry governance; new Phase 4 gate `DI-P4-OperatorShortcutsVersion` asserts the bump + changelog entry. **H2** (hydration/serialization grep gate): new Phase 4 gate `DI-P4-NoDIFieldsInPersistence` asserts `dynamicInputRecall` / `dynamicInput.locked` / `dynamicInput.recallActive` do NOT appear in `packages/domain/src/serialize.ts` or `packages/domain/src/schemas/` (hard gate proving §8 "unchanged" claim). **H3** (shorthand in §3.1): every "File:line" cell now uses the full path; all 24 grounding rows use markdown links to the canonical absolute path. |

## 1. Goal

The Dynamic Input (DI) chrome that surfaces while a draw tool is active currently does three things badly relative to AC parity:

1. **B6 — Pills don't reflect the cursor.** Empty pills show only their label (e.g., `Distance:`). AC shows the live cursor-derived value (e.g., `Distance: 6.282`) which updates as the user moves the mouse — a user can read the live geometry without looking at the canvas dim guides.
2. **B7 — Polar input has no direction inversion + no per-pill lock.** Typing `Distance=5` while the cursor is in Q3 currently snaps the rubber-band to Q1 (combiner ignores cursor). Tab cycles the active field; it never freezes a typed value, so the user cannot "lock the angle and let distance follow the cursor."
3. **B8 — Buffer recall is opaque.** The Round 7 Phase 2 dim-placeholder mechanic pre-fills the most recent submitted values into the empty pills; users find this confusing (the value LOOKS active but isn't until Enter). AC's mental model is an explicit recall pill at the cursor on Arrow Up.

The fix is one coherent overhaul of the DI pipeline:

1. **Contract** (Phase 1): rename `commandBar.lastSubmittedBuffers` → `commandBar.dynamicInputRecall`; add `commandBar.dynamicInput.locked: boolean[]`; runner initializes `locked` parallel to `buffers`. Placeholder slice + chrome stay intact this phase (Phase 4 retires them with the ArrowUp pill).
2. **B6 Live cursor** (Phase 2): pill chrome reads live geometry from `overlay.dimensionGuides[idx]` (linear-dim → length, angle-arc → degrees) when the buffer is empty AND the field is not locked.
3. **B7 Lock + inversion** (Phase 3): Tab on a typed field freezes it (`locked[idx] = true`); router fires implicit submit when all fields locked; combiner becomes cursor-aware (signature gains `cursor: Point2D | null` only — `locked` lives on the slice + router, not the combiner, per A19); rectangle / polyline / line tool commit paths gain signed-numberPair semantics (drop `Math.abs`); two-step Esc unlocks-then-aborts.
4. **B8 Arrow Up recall + drop placeholders** (Phase 4): add `commandBar.dynamicInput.recallActive: boolean`; ArrowUp shows a recall pill at the cursor with the most-recent submit for the prompt key; Enter / Space accepts; Tab / ArrowDown cancels; runner subscription freezes preview + dimensionGuides while recall is active. Drop the `placeholders: string[]` field, the `pillPlaceholder` style class, the `data-pill-placeholder` attribute, the EditorRoot placeholder-fallback path, and the smoke-e2e dim-placeholder scenario per GR-1 clean-break.

## 2. Background / context

### 2.1 Why bundle B6 + B7 + B8 (vs. three separate plans)

These three items share three contracts:

- **Slice shape** (`commandBar.dynamicInput`). B6 needs no slice change (lives in chrome). B7 adds `locked: boolean[]`. B8 adds `recallActive: boolean` and drops `placeholders: string[]`. Splitting means three slice migrations (Phase 1 extension; Phase 3 extension; Phase 4 extension + cleanup); bundling means one.
- **Manifest pipeline** (`combineDynamicInputBuffers`). B6 doesn't change the combiner (chrome reads cursor directly). B7 changes the signature: `(manifest, buffers, anchor, cursor) => Input | null` (single new param per A19). B8 doesn't touch the combiner directly but the runner subscription's freeze-while-recallActive interacts with the same cursor-driven path B7 introduces. Splitting means changing the combiner signature twice or threading a stub argument.
- **Recall map** (`commandBar.dynamicInputRecall`). B6 doesn't use it. B7 doesn't use it. B8 fully replaces the placeholder consumption pattern with ArrowUp consumption. The rename forces every consumer to acknowledge the contract change instead of silently inheriting the old design (per the user's lock decision #8).

Each phase still gets its own commit + Codex audit pass — the bundling is at the plan-authoring level (one branch, one plan, four commits). Each phase has independent gates.

### 2.2 The Round 7 Phase 2 placeholder design is being retired

Round 7 Phase 2 (commit `f2b9c26`-era, currently in `main`) pre-fills the most recent submitted buffers into the empty pills as dim placeholder text. Empty Enter accepts the placeholder via a fallback in `EditorRoot.onSubmitDynamicInput`. The user found this confusing: the pill LOOKS like it has a value, but typing replaces it without any visual transition. Per GR-1 (preproduction clean-break), we drop the design entirely and rebuild via Arrow Up recall pill at the cursor. No backwards-compat scaffold.

### 2.3 SSOT for live cursor values: `overlay.dimensionGuides`

Per ADR-025 §3, dimension guides are the SSOT for the geometric semantics of an in-flight prompt — line / polyline / rectangle / circle / xline each yield `dimensionGuides` aligned 1:1 with `manifest.fields` (store invariant: `dimensionGuides.length === manifest.fields.length`). Each guide already encodes the geometric quantity:

- `linear-dim` → distance = `hypot(anchorB.x - anchorA.x, anchorB.y - anchorA.y)`.
- `angle-arc` → angle in degrees = `(sweepAngleRad * 180 / Math.PI)`.

B6's "live computer" is therefore deterministic from the existing slice — pill chrome derives display text from `dimensionGuides[idx]` per kind. No new manifest field, no parallel `liveCompute` callback. (Question Q1 in §1.13 — recommendation locked at option (c).)

## 3.0 Prerequisite evidence (Rev-2 added per Codex Round-1 B1; Rev-4 expanded per Codex Round-3 B1)

Every binding spec / procedure file consulted during plan authoring is enumerated below. Codex Round-1 B1 flagged that the plan made heavy spec claims without explicitly evidencing prerequisite reads; this table closes that gap. Codex Round-3 B1 (Partial Agree) further clarified: the architecture contract exists in BOTH `docs/procedures/Claude/` (author-role copy) AND `docs/procedures/Codex/` (reviewer-role copy) — the two are mirrors with reviewer-role framing differences only (verified via `diff -u`); the prerequisite evidence table now lists BOTH so each reviewer role's procedure references the exact path it expects. Each row records the file read at authoring time. Reviewers can re-confirm by running `test -f <path>` on the citations.

### 3.0.a — Author-role prerequisites (Claude side, consulted while authoring this plan)

| Doc / procedure | Path | Read at authoring time? | Why consulted |
|---|---|---|---|
| Procedure 00 (author copy) — Architecture Contract | `docs/procedures/Claude/00-architecture-contract.md` | Yes (full file 1-377) | Enumerates binding ADRs, registry rules, GR-1 / GR-2 / GR-3, §0.7 Approved Deviation Protocol. Plan §6 ("Deviations") + §A1 (preproduction clean-break) + §A6 (no forward-extensibility placeholders) reference this directly. |
| Procedure 01 — Plan Authoring | `docs/procedures/Claude/01-plan-authoring.md` | Yes (full file 1-612) | Defines the §1.3 three-round self-audit, §1.4.1 plan-vs-code grounding, §1.5 scope template, §1.8 invariants + enforcement, §1.12 mandatory completion gates, §1.13 pre-response notification, §1.16.12 stale-symbol purge. This plan's structure follows §1.11 mandatory section order. |

### 3.0.b — Reviewer-role prerequisites (Codex side, expected by Procedure 02 strict-evidence review)

| Doc / procedure | Path | Required by Codex review? | Author confirmation |
|---|---|---|---|
| Procedure 00 (reviewer copy) — Architecture Contract | `docs/procedures/Codex/00-architecture-contract.md` | Yes — Codex Procedure 02 prerequisite | Confirmed exists at this path; verified Rev-4 via `ls docs/procedures/Codex/`. The Claude-side and Codex-side files mirror the same binding ADR list (verified via `diff -u`); the differences are reviewer-role framing only (e.g., "Codex uses this document to determine whether an implementation conforms or deviates" vs. "Read this file before starting any task"). The architecture content (binding ADRs §0.2, GR-1/2/3 §0.4, deviation protocol §0.7) is identical at the binding level. Author has read the Claude-side copy at plan-authoring time; Codex MAY use the Codex-side copy during review without divergence risk. |
| Procedure 02 — Plan Review (Codex protocol) | `docs/procedures/Codex/02-plan-review.md` | Yes — this is the Codex review protocol | Confirmed exists at this path. Author has NOT read this file (it's the reviewer's protocol, not the author's); the §1.13 pre-response notification template + the supported-pair-matrix pattern + command-concrete gate quality bar in this plan are derived from observing what Codex requires per the snap-engine-extension precedent (Codex 9.8/10 Go). |
| ADR-025 — Dynamic Input Manifest v2 | `docs/adr/025-dynamic-input-manifest-v2.md` | Yes (full file 1-247) | Authoritative DI manifest contract. §4 angle-as-degrees invariant, §1 angle-arc geometry, §6 DIM_OFFSET_CSS SSOT, §7 angle-pill placement. Plan §6 declares no ADR-025 amendment because the cursor-aware combiner is implementation-internal. |
| ADR-023 — Tool State Machine + Command Bar | `docs/adr/023-tool-state-machine-and-command-bar.md` | Yes (skimmed for shortcut governance) | Authority for `docs/operator-shortcuts.md` registry; sourced the version-bump governance for the H1 fix. |
| `docs/operator-shortcuts.md` | full file | Yes (head 1-30 + changelog table 133-140) | Confirmed current version `2.1.0`; Phase 4 bumps to `2.2.0` (minor — adding ArrowUp/ArrowDown). Governance: "Adding a new shortcut: minor version bump." |
| `docs/plans/feature/m1-3-canvas-tokens-and-di-polish.md` | full file lines 1-280 | Yes (precedent for B8 placeholder design retired) | Retired in Phase 4 of THIS plan. |
| `docs/plans/feature/m1-3-snap-engine-extension.md` | full file 1-432 | Yes (structural precedent — Codex 9.8/10) | Plan structure (§4.0.1 supported pair matrix, command-concrete gate tables, §3.1 grounding table) modeled on this. |
| `packages/editor-2d/src/ui-state/store.ts` | full file 1-595 | Yes (slice contract grounding) | §3.1 rows 1-3, 5; A8 / A10 / A19 lock targets. |
| `packages/editor-2d/src/tools/runner.ts` | full file 1-253 | Yes (function-based runner per Round-6 §1.4.1 lesson) | §3.1 row 7-9; A16 freeze-during-recall hook site. |
| `packages/editor-2d/src/tools/types.ts` | full file 1-246 | Yes (manifest types + Prompt interface) | §3.1 row 24; confirms `Prompt.persistKey?` carries forward (A17). |
| `packages/editor-2d/src/tools/dynamic-input-combine.ts` | full file 1-101 | Yes (current combiner signature + 4 arms) | §3.1 row 10-11; Phase 3 step 1 signature target. |
| `packages/editor-2d/src/EditorRoot.tsx` | lines 1-260, 455-700 | Yes (DI submit handler + click-eat) | §3.1 row 12-13; Phase 3 step 2 cursor threading; Phase 4 step 2 placeholder cleanup. |
| `packages/editor-2d/src/chrome/DynamicInputPills.tsx` | full file 1-185 | Yes (current pill render + fallback offsets) | §3.1 row 14-15; Phase 2 step 2 + Phase 4 step 4 render-branch targets. |
| `packages/editor-2d/src/keyboard/router.ts` | full file 1-401 | Yes (Tab cycle, Esc, no ArrowUp) | §3.1 row 16-18; Phase 3 + Phase 4 router-extension targets. |
| `packages/editor-2d/src/tools/draw/draw-line.ts` | full file 1-72 | Yes (LINE_DI_MANIFEST + dimensionGuides shape) | §3.1 row 20. |
| `packages/editor-2d/src/tools/draw/draw-rectangle.ts` | full file 1-170 | Yes (`Math.abs(c1.a)` / `Math.abs(c1.b)` commit branches) | §3.1 row 21; Phase 3 step 5 deletion target. |
| `packages/editor-2d/src/tools/draw/draw-circle.ts` | full file 1-71 | Yes (`Math.abs(edge.value)` reject-zero) | §3.1 row 22; A11 lock. |
| `packages/editor-2d/src/tools/draw/draw-polyline.ts` | full file 1-130 | Yes (`persistKey: 'next-vertex'` confirmed) | §3.1 row 23; A17 lock. |
| `packages/editor-2d/src/tools/draw/draw-xline.ts` | full file 1-73 | Yes (xline single-field [Angle] manifest) | A12 lock. |
| `packages/editor-2d/tests/smoke-e2e.test.tsx` | lines 1290-1349 | Yes (Round 7 Phase 2 placeholder smoke scenario to be rewritten) | §3.1 row 19; Phase 4 step 8 rewrite target. |
| `packages/editor-2d/tests/dynamic-input-combine.test.ts` | head 1-100 | Yes (existing 7 test cases) | Phase 3 step 6 fixture base. |
| `packages/editor-2d/tests/ui-state.test.ts` | lines 374-450 | Yes (Round 7 Phase 2 placeholder + record tests) | Phase 1 step 6 update target. |
| `packages/domain/src/serialize.ts` | head/structure | Yes (path confirmed for H2 grep gate) | Phase 4 gate `DI-P4-NoDIFieldsInPersistence` target. |
| `packages/domain/src/schemas/` | directory listing | Yes (path confirmed for H2 grep gate) | Phase 4 gate `DI-P4-NoDIFieldsInPersistence` target. |

All paths verified with `test -f` (or `ls` for directories) at authoring time. No path is assumed without observation.

## 3. Assumptions + locks

User-confirmed during scoping (chat 2026-04-30) and adopted as plan locks. These do NOT get re-litigated mid-execution:

- **A1 — Pill DISPLAYS absolute value of typed magnitude.** Typed `-5` renders as `5`. Buffer storage retains `-5` for combiner sign. Implementation: `valueText = buffer.startsWith('-') ? buffer.slice(1) : buffer`.
- **A2 — Empty field = unlocked, live cursor read.** Tab on an empty field is a no-op for locking (just navigates `activeFieldIdx`). Tab on a typed field freezes it (`locked[idx] = true`) AND navigates.
- **A3 — Two-step Esc.** First press: if recall is active, cancel recall; else if any field locked, unlock all (set `locked = Array(N).fill(false)`); else fall through to the existing abort path. Second press (or first press when nothing locked / no recall): abort tool. Precedence: recall > unlock > abort.
- **A4 — Direction inversion applies to W/H (rectangle) too, not just polar `Distance/Angle`.** Cursor direction wins; typed sign optionally flips. Formula codified in §4.0.1 §4.0.2 / Phase 3 step 4.
- **A5 — Arrow Up = MOST RECENT submit only.** No history scrolling (no further key combinations to walk older submits). Single-step recall.
- **A6 — No units displayed.** Pill text shows `Distance: 6.282`, NOT `Distance: 6.282 m`. Recall pill shows `Distance=5 / Angle=30`, NOT `Distance=5m / Angle=30°`. **Per-field unit slot is NOT added to `DynamicInputField` in this plan** (Q-CLARIFY in §1.13 — see §6 "Deferred contract additions"). Per GR-2 architecture-first, future config-option work writes a new ADR amendment when a concrete consumer exists.
- **A7 — B6 + B7 + B8 land TOGETHER as one branch + one plan, four phases / four commits.** Each phase has its own Codex audit pass.
- **A8 — Slice rename: `lastSubmittedBuffers` → `dynamicInputRecall`.** Map shape (`Record<string, string[]>`) preserved. The rename forces every consumer to acknowledge the consumption-pattern change (placeholder pre-fill → ArrowUp recall pill).
- **A9 — Live computer placement: option (c).** Pill chrome derives live text from `overlay.dimensionGuides[idx]` per kind (linear-dim length / angle-arc degrees). No new optional `liveCompute` callback on `DynamicInputField`; no parallel computer in the runner. Single source: the same dimension-guide already painted on the canvas.
- **A10 — Lock state location: option (a).** `commandBar.dynamicInput.locked: boolean[]` is the single source. Runner reads it at submit time via `editorUiStore.getState()` (function-runner pattern; runner is NOT a class so there is no parallel "internal lock state" to reconcile).
- **A11 — Circle radius inversion: NONE.** `combineAs: 'number'` (single field) has no direction to flip. Existing semantics preserved: combiner emits `{ kind: 'number', value }`; tool calls `Math.abs(value)` and rejects zero. Negative typed value is taken as-is by the combiner; the tool's abs-reject path produces the same UX as today.
- **A12 — Xline angle inversion: NONE.** `combineAs: 'angle'` (single field). xline is bidirectional (infinite construction line); no direction to flip. Combiner emits `{ kind: 'angle', radians }` unchanged.
- **A13 — Recall pill positioning: cursor + (16, 28) CSS-px.** Reuse the existing legacy fallback offset from `DynamicInputPills.tsx:34-35` (`FALLBACK_PILL_OFFSET_X_PX = 16`, `FALLBACK_PILL_OFFSET_Y_PX = 28`). Recall pill follows cursor on `overlay.cursor` change (Q5 user lock).
- **A14 — Recall pill text format: `${label}=${value}` joined ` / `.** Matches the existing command-bar history convention in `EditorRoot.tsx:236-241`. With `Distance` / `Angle` labels: `Distance=5 / Angle=30`. Field labels' first letters are NOT abbreviated (the user's `D=5 / A=30` example was illustrative; full labels are correct since they match the source-of-truth manifest).
- **A15 — Live value rounding: `toFixed(3)` for distance fields, `toFixed(2)` for angle fields, `toFixed(2)` for number (W/H) fields.** Decimals chosen to match what users see in canvas dim labels (`paintDimensionGuides` formats lengths with 3 decimals via the `formatLength` helper at `paintDimensionGuides.ts`); angles get 2 (sub-degree precision is not useful in metric drafting). Reviewed — no precedent contradicts. Codified in §4.0.2 + Phase 2 step 3.
- **A16 — Runner freeze during recall.** Implementation: the runner's preview / dimension-guides subscription handler reads `state.commandBar.dynamicInput?.recallActive` at the top of its callback and short-circuits if true. No separate "freeze" slice flag. Synchronous bootstrap on prompt-yield is unaffected (recall isn't possible at first yield; the bootstrap runs before the user can press ArrowUp).
- **A17 — Polyline `persistKey: 'next-vertex'` carries forward.** Round 7 Phase 2 `Prompt.persistKey` field stays. The recall key construction (`${toolId}:${prompt.persistKey ?? promptIndex}`) is unchanged. Polyline's per-loop next-vertex prompt continues to share one recall-bucket so Distance / Angle typed for vertex N surfaces as the recall on ArrowUp at vertex N+1 AND across tool re-invocations.
- **A18 — Auto-submit when all fields locked.** When the router's Tab-handler transitions the LAST unlocked field with a typed buffer to locked, AND `every(locked)` becomes true, the router immediately fires `onSubmitDynamicInput(manifest, buffers)` and the standard submit path runs (combiner → feedInput → clearDynamicInput). This is the implicit-commit behavior the user specified. Empty fields cannot trigger auto-submit because Tab on empty is a no-op for locking (A2).
- **A19 — Combiner signature change.** `combineDynamicInputBuffers(manifest, buffers, anchor)` → `combineDynamicInputBuffers(manifest, buffers, anchor, cursor)`. One new param: `cursor: Point2D | null`. May be `null` when no mousemove has happened yet on canvas (degenerate but possible — DI submit fires immediately on tool start). Combiner falls back to typed-value-only semantics if cursor is null AND every required buffer is non-empty; if any required buffer is empty AND cursor is null, returns null (existing combiner contract: "ignore submit"). The `locked: boolean[]` slice field is NOT threaded into the combiner — its semantic role lives in chrome (suppress live read on locked field) and router (don't re-lock on Tab); buffer-emptiness is the sole gate for "use cursor instead of typed value" per §4.0.2 formulas. (Per GR-1: no unused parameters.)

## 3.1 Plan-vs-code grounding table (§1.4.1)

Every cited path was verified with `test -f` at Rev-1 authoring time. Match column reflects observation against the file at the cited line range.

| # | Plan claim | File:line | Observed shape | Match |
|---|-----------|-----------|----------------|-------|
| 1 | `commandBar.dynamicInput` slice shape includes `manifest`, `buffers`, `activeFieldIdx`, `promptKey`, `placeholders` | [packages/editor-2d/src/ui-state/store.ts:133-156](packages/editor-2d/src/ui-state/store.ts) | TypeScript object literal matches verbatim | Match |
| 2 | `commandBar.lastSubmittedBuffers: Record<string, string[]>` | [packages/editor-2d/src/ui-state/store.ts:166](packages/editor-2d/src/ui-state/store.ts) | `lastSubmittedBuffers: Record<string, string[]>;` | Match — Phase 1 renames to `dynamicInputRecall` |
| 3 | `setDynamicInputManifest(manifest, promptKey)` initializes `placeholders` from `lastSubmittedBuffers[promptKey]` | [packages/editor-2d/src/ui-state/store.ts:524-538](packages/editor-2d/src/ui-state/store.ts) | Action body matches | Match — Phase 1 initialization gains `locked: Array(N).fill(false)`, drops placeholder seed |
| 4 | `recordSubmittedBuffers(promptKey, buffers)` writes to `lastSubmittedBuffers` | [packages/editor-2d/src/ui-state/store.ts:548-552](packages/editor-2d/src/ui-state/store.ts) | Mutator body matches | Match — Phase 1 renames action target slice; signature unchanged |
| 5 | `editorUiActions` has no `setDynamicInputFieldLocked` action | [packages/editor-2d/src/ui-state/store.ts:553-571](packages/editor-2d/src/ui-state/store.ts) | Only `setDynamicInputActiveField` and `setDynamicInputFieldBuffer` and `clearDynamicInput` present | Match — Phase 1 adds new mutators |
| 6 | Runner derives promptKey at `${toolId}:${prompt.persistKey ?? promptIndex}` | [packages/editor-2d/src/tools/runner.ts:155-157](packages/editor-2d/src/tools/runner.ts) | `const promptKey = \`${toolId}:${prompt.persistKey ?? promptIndex}\`;` verbatim | Match — Phase 1 keeps unchanged |
| 7 | Runner is FUNCTION-based (not class) — `startTool(toolId, factory): RunningTool` | [packages/editor-2d/src/tools/runner.ts:38](packages/editor-2d/src/tools/runner.ts) | `export function startTool(...): RunningTool` | Match (re-asserted post-Round-6 §1.4.1 lesson) |
| 8 | Runner subscription seeds `previewBuilder` + `dimensionGuidesBuilder` per cursor-tick | [packages/editor-2d/src/tools/runner.ts:67-89](packages/editor-2d/src/tools/runner.ts) | Subscription body matches; both builders re-invoked on cursor diff | Match — Phase 4 adds `recallActive` short-circuit at handler top |
| 9 | Runner sync-bootstrap wraps builder seed in `inSyncBootstrap` try/finally | [packages/editor-2d/src/tools/runner.ts:171-186](packages/editor-2d/src/tools/runner.ts) | `inSyncBootstrap = true; try { ... } finally { inSyncBootstrap = false; }` | Match — Phase 4 leaves bootstrap untouched (recall happens after first yield) |
| 10 | `combineDynamicInputBuffers(manifest, buffers, anchor): Input \| null` is the current signature | [packages/editor-2d/src/tools/dynamic-input-combine.ts:38-42](packages/editor-2d/src/tools/dynamic-input-combine.ts) | Signature matches verbatim | Match — Phase 3 adds `cursor: Point2D \| null` parameter (only one new param per A19; `locked` lives only on the slice + router) |
| 11 | Combiner has 4 arms: `numberPair`, `point`, `number`, `angle` | [packages/editor-2d/src/tools/dynamic-input-combine.ts:55-100](packages/editor-2d/src/tools/dynamic-input-combine.ts) | All four switch cases present | Match — Phase 3 modifies `numberPair` + `point` arms; `number` + `angle` arms left as-is per A11/A12 |
| 12 | EditorRoot.onSubmitDynamicInput uses placeholders for empty-buffer fallback | [packages/editor-2d/src/EditorRoot.tsx:213-256](packages/editor-2d/src/EditorRoot.tsx) | `effectiveBuffers = buffers.map((b, i) => b.length > 0 ? b : placeholders[i] ?? '')` | Match — Phase 4 drops the fallback (placeholders gone) |
| 13 | EditorRoot.onSubmitDynamicInput calls `recordSubmittedBuffers(promptKey, effectiveBuffers)` | [packages/editor-2d/src/EditorRoot.tsx:253-256](packages/editor-2d/src/EditorRoot.tsx) | Call matches | Match — Phase 1 renames to record into `dynamicInputRecall` |
| 14 | DynamicInputPills.tsx reads `placeholders[idx]` and renders `pillPlaceholder` style | [packages/editor-2d/src/chrome/DynamicInputPills.tsx:79-99](packages/editor-2d/src/chrome/DynamicInputPills.tsx) | `const placeholder = dynamicInput.placeholders[idx] ?? '';` + `placeholderClass` ternary | Match — Phase 4 drops both. Phase 2 inserts the live-cursor branch. |
| 15 | DynamicInputPills.tsx fallback pill offsets `(16, 28)` | [packages/editor-2d/src/chrome/DynamicInputPills.tsx:34-35](packages/editor-2d/src/chrome/DynamicInputPills.tsx) | `FALLBACK_PILL_OFFSET_X_PX = 16` / `FALLBACK_PILL_OFFSET_Y_PX = 28` | Match — Phase 4 reuses for the recall pill (per A13) |
| 16 | Keyboard router's Tab handler calls `cycleDIActiveField(direction)` | [packages/editor-2d/src/keyboard/router.ts:222-230](packages/editor-2d/src/keyboard/router.ts) | `if (di && di.manifest.fields.length > 1) { e.preventDefault(); cycleDIActiveField(...); }` | Match — Phase 3 extends to lock-on-typed-value + auto-submit-when-all-locked |
| 17 | Router's Esc handler does single-step abort (clearAccumulator + setInputBuffer + clearDynamicInput + onAbortCurrentTool) | [packages/editor-2d/src/keyboard/router.ts:205-216](packages/editor-2d/src/keyboard/router.ts) | Body matches | Match — Phase 3 grows two-step semantics (recall cancel → unlock all → abort) |
| 18 | Router has no ArrowUp / ArrowDown handler | [packages/editor-2d/src/keyboard/router.ts:164-365](packages/editor-2d/src/keyboard/router.ts) | No `key === 'ArrowUp'` branch present | Match — Phase 4 adds both |
| 19 | Round 7 Phase 2 buffer-persistence smoke-e2e scenario asserts `data-pill-placeholder='true'` and `Distance: 5` | [packages/editor-2d/tests/smoke-e2e.test.tsx:1296-1349](packages/editor-2d/tests/smoke-e2e.test.tsx) | Test body matches; asserts placeholder design | Match — Phase 4 REWRITES the scenario to ArrowUp recall pill + Enter |
| 20 | `draw-line.ts` LINE_DI_MANIFEST = 2-field distance/angle, combineAs:'point' | [packages/editor-2d/src/tools/draw/draw-line.ts:12-18](packages/editor-2d/src/tools/draw/draw-line.ts) | Object literal matches | Match |
| 21 | `draw-rectangle.ts` numberPair branch calls `Math.abs(c1.a)` / `Math.abs(c1.b)` | [packages/editor-2d/src/tools/draw/draw-rectangle.ts:128-144](packages/editor-2d/src/tools/draw/draw-rectangle.ts) | `const width = Math.abs(c1.a); const height = Math.abs(c1.b);` | Match — Phase 3 drops the abs() and re-derives `origin = min(corner1, corner1+W,corner1+H)` so signed numberPair commits the correct rectangle in any quadrant |
| 22 | `draw-circle.ts` number branch calls `Math.abs(edge.value)` | [packages/editor-2d/src/tools/draw/draw-circle.ts:42-43](packages/editor-2d/src/tools/draw/draw-circle.ts) | `const radius = Math.abs(edge.value);` | Match — A11 lock: behavior preserved (no change Phase 3); negative typed circle radius is rejected by tool's abs/reject path. |
| 23 | `draw-polyline.ts` next-vertex prompt sets `persistKey: 'next-vertex'` | [packages/editor-2d/src/tools/draw/draw-polyline.ts:58](packages/editor-2d/src/tools/draw/draw-polyline.ts) | Field present | Match — A17 lock |
| 24 | ADR-025 §4 declares angle-as-degrees invariant in combiner | [docs/adr/025-dynamic-input-manifest-v2.md:134-148](docs/adr/025-dynamic-input-manifest-v2.md) | Section text matches | Match — Phase 3 cursor-aware refinement does NOT change deg→rad conversion semantics |

## 4. Scope

### 4.1 In scope — files modified

| Path | Phase | Change |
|---|---|---|
| `packages/editor-2d/src/ui-state/store.ts` | 1, 4 | **Phase 1:** rename `commandBar.lastSubmittedBuffers` → `commandBar.dynamicInputRecall` (slice field + initial state + action). Add `commandBar.dynamicInput.locked: boolean[]` field. Update `setDynamicInputManifest` action: initialize `locked: Array(N).fill(false)` parallel to `buffers`. Add new mutators `setDynamicInputFieldLocked(idx, locked)` and `unlockAllDynamicInputFields()`. **Phase 4:** drop `commandBar.dynamicInput.placeholders: string[]` field. Add `commandBar.dynamicInput.recallActive: boolean` field (init `false` in `setDynamicInputManifest`). Add new mutator `setDynamicInputRecallActive(active: boolean)`. Drop the placeholder-seeding lines in `setDynamicInputManifest`. |
| `packages/editor-2d/src/EditorRoot.tsx` | 1, 3, 4 | **Phase 1:** rename `recordSubmittedBuffers` consumption to write into `dynamicInputRecall` (action body update only — call site unchanged). **Phase 3:** in `onSubmitDynamicInput`, read `cursor = overlay.lastKnownCursor` and pass to `combineDynamicInputBuffers` as the 4th arg (per A19, no `locked` thread-through). **Phase 4:** drop `placeholders` reads + `effectiveBuffers` placeholder-fallback path; combine raw `buffers` directly (empty → null per existing combiner contract). Drop `cb.dynamicInput?.placeholders ?? []` line + the `effectiveBuffers` map. The new ArrowUp recall path (router-driven) already injects effective buffers via the recalled values; pill chrome's "what to display in the empty pill" question is answered by Phase 2 (live cursor) instead of placeholders. |
| `packages/editor-2d/src/tools/dynamic-input-combine.ts` | 3 | Signature change: `combineDynamicInputBuffers(manifest, buffers, anchor)` → `combineDynamicInputBuffers(manifest, buffers, anchor, cursor)`. One new param per A19. New logic per arm (per §4.0.2): `'point'` arm uses cursor when distance / angle buffer is empty; `'numberPair'` arm uses cursor's quadrant for W/H signs. `'number'` and `'angle'` arms unchanged (A11 / A12). Per-field parsing logic: when `buffers[idx]` is empty, derive value from cursor (live read at submit time matches what pill displays); when non-empty, parse as before — for `'point'` distance and `'numberPair'` W/H, signed parse — DO NOT abs in combiner; abs happens in display layer per A1. |
| `packages/editor-2d/src/tools/types.ts` | (none) | Manifest types unchanged. `Prompt.persistKey?: string` carries forward (A17). `DynamicInputField` does NOT gain a `unit?` field (A6 lock; deferred to a future ADR amendment per §6 Deviations). |
| `packages/editor-2d/src/tools/runner.ts` | 4 | Subscription handler at `runner.ts:67-89` short-circuits at top when `state.commandBar.dynamicInput?.recallActive === true` (per A16). Synchronous bootstrap at `runner.ts:171-186` left untouched (recall isn't possible at first yield). |
| `packages/editor-2d/src/keyboard/router.ts` | 3, 4 | **Phase 3:** extend Tab handler — when active field has typed buffer (non-empty), set `locked[idx] = true` BEFORE cycling. After cycle (or after lock if cycling fails because there's only one field), check `every(locked)`: if true, fire `onSubmitDynamicInput(manifest, buffers)` for implicit commit. Empty field → cycle only (no lock). Two-step Esc: if `recallActive` → set false; else if any `locked` → unlock all; else → existing abort path. **Phase 4:** add `key === 'ArrowUp'` handler — when DI active AND `dynamicInputRecall[promptKey]` non-empty → `setDynamicInputRecallActive(true)`. Add `key === 'ArrowDown'` handler — when `recallActive` → `setDynamicInputRecallActive(false)`. Tab handler — when `recallActive` → cancel (set false), do NOT cycle / lock. Enter / Space handlers — when `recallActive` and DI active → fire `onSubmitDynamicInput(manifest, recalledBuffers)` where `recalledBuffers = dynamicInputRecall[promptKey]`. |
| `packages/editor-2d/src/chrome/DynamicInputPills.tsx` | 2, 4 | **Phase 2:** new helper `deriveLivePillValue(guide: DimensionGuide): string` (single arg; `fieldKind` is NOT a parameter per Phase 2 step 1 GR-1 rationale) — `linear-dim` → `hypot(B-A).toFixed(3)`; `angle-arc` → `(sweepAngleRad * 180 / Math.PI).toFixed(2)`. Empty-buffer + unlocked-field render path: `valueText = deriveLivePillValue(guide)`. Empty-buffer + locked-field: keep displaying empty (semantic edge case — empty + locked happens only via Backspace-on-locked or direct `setDynamicInputFieldLocked`; Tab on empty doesn't lock per A2). Buffer non-empty: `valueText = buffer.startsWith('-') ? buffer.slice(1) : buffer` per A1. **Phase 4:** drop `placeholders[idx]` reads (`const placeholder = dynamicInput.placeholders[idx] ?? '';`); drop `pillPlaceholder` style class application; drop `data-pill-placeholder` attribute. Add new render branch — when `recallActive` is true: dim per-field pills (apply `pillDimmed` style class to each); render new RecallPill at cursor + (16, 28) CSS-px offset with `${label}=${value}` format joined ` / ` (per A13 / A14). |
| `packages/editor-2d/src/chrome/DynamicInputPills.module.css` | 2, 4 | **Phase 2:** no new CSS class (live values use existing `.pill` styling — they look identical to typed values; only difference is the source of `valueText`). **Phase 4:** drop `.pillPlaceholder` rule (no longer applied). Add new `.recallPill` rule (background slightly different to distinguish from per-field pills — TBD; reuses existing `.pill` shape with a token-driven background tint). |
| `packages/editor-2d/src/tools/draw/draw-rectangle.ts` | 3 | Drop `Math.abs(c1.a)` / `Math.abs(c1.b)` in numberPair commit branches (lines 128-144). Re-derive: `const otherCorner = { x: corner1.x + c1.a, y: corner1.y + c1.b }; const minX = Math.min(corner1.x, otherCorner.x); const minY = Math.min(corner1.y, otherCorner.y); const width = Math.abs(c1.a); const height = Math.abs(c1.b); const origin = { x: minX, y: minY };` (origin is min-corner; width/height stay positive in the primitive). Validates: zero values still abort. Same logic for the F3 [Dimensions] sub-flow at lines 101-123 — drop the unconditional `Math.abs` of `dims.a` / `dims.b` so the typed sub-flow honors signed input too. (Note: F3 sub-flow doesn't have a cursor-based commit because it explicitly types `width,height` at a separate prompt; but if user types `-5,4`, the rectangle should still extend left-and-up — same logic.) |
| `packages/editor-2d/src/tools/draw/draw-circle.ts` | (none) | A11 lock: no change. Existing `Math.abs(edge.value)` reject-zero logic preserved. |
| `packages/editor-2d/src/tools/draw/draw-line.ts` | (none) | No tool-level change. The combiner's signed `'point'` output already lands at `anchor + signed_dist * (cos cursor_angle, sin cursor_angle)`, which is what the line's existing `addPrimitive({ p1, p2: end.point })` consumes correctly. |
| `packages/editor-2d/src/tools/draw/draw-polyline.ts` | (none) | Same — combiner's signed point output lands correctly via `addPrimitive({ vertices, ... })`. `persistKey: 'next-vertex'` carries forward. |
| `packages/editor-2d/tests/ui-state.test.ts` | 1, 3, 4 | **Phase 1:** rename test cases referencing `lastSubmittedBuffers` → `dynamicInputRecall`; rename action-call test cases (the `recordSubmittedBuffers` action body still exists but writes into the renamed slice). New tests for `setDynamicInputFieldLocked` + `unlockAllDynamicInputFields` mutators. **Phase 3:** new test for `Tab on typed field locks then cycles` semantic (router test, not slice test — moved to `keyboard-router.test.ts`); slice-side test asserts `setDynamicInputFieldLocked` mutator works. **Phase 4:** add `setDynamicInputRecallActive` mutator test; drop placeholder-seeding tests. |
| `packages/editor-2d/tests/keyboard-router.test.ts` | 3, 4 | **Phase 3:** new tests for Tab-on-typed locks + auto-submit on all-locked + Esc two-step behavior. **Phase 4:** new tests for ArrowUp / ArrowDown / Tab during recall / Enter during recall. Test pattern: mock `editorUiActions.setCursor` for synthetic cursor inputs; fire `KeyboardEvent` via `fireEvent.keyDown(window, ...)` per existing tests. |
| `packages/editor-2d/tests/dynamic-input-combine.test.ts` | 3 | Signature update — every `combineDynamicInputBuffers(...)` call gains `cursor` param (single new param per A19; combiner has NO `locked` param). Existing 7 cases pass `null` cursor (their non-empty buffers preserve bit-identical behaviour). Add new tests for direction inversion: line/polyline `'point'` arm with cursor in Q3 + typed Distance=5 + empty Angle → combiner uses cursor for angle, produces point in Q3; cursor in Q3 + typed Distance=-5 → point in Q1 (signed flip). Rectangle `'numberPair'` arm with cursor right-down + typed W=-5 → signed-W extends left. |
| `packages/editor-2d/tests/DynamicInputPills.test.tsx` | 2, 4 | **Phase 2:** (a) DELETE the obsolete `Round 7 Phase 2 — dim placeholder rendering` describe block (lines 146-220) — Phase 2's live-cursor render path makes those assertions invalid (the `data-pill-placeholder` attribute is removed; empty-buffer pills show live cursor reads, not persisted-buffer text). (b) ADD new tests for live-cursor render — set up DI manifest + dimensionGuides; assert pill text reflects guide-derived value at given cursor. Tests: linear-dim → length to 3 decimals; angle-arc → degrees to 2 decimals; typed buffer overrides live; locked + empty stays blank; abs-of-typed display. **Phase 4:** new tests for recall pill render — `setDynamicInputRecallActive(true)`; assert recall pill present with correct text + position; per-field pills get `pillDimmed` style. [§3.10 patch 2026-05-01: placeholder-test deletion moved from Phase 4 to Phase 2 because Phase 2's render-path change makes them fail immediately. Plan-vs-reality sequencing fix; no scope change.] |
| `packages/editor-2d/tests/draw-tools.test.ts` | 3 | New tests asserting rectangle's signed-numberPair commit produces correct origin in all 4 quadrants. Polyline test for cursor-driven angle when Distance buffer is non-empty + Angle buffer is empty — combiner uses cursor for angle, produces signed-distance × cursor-direction. (Asserts combiner behaviour given the slice setup; does not test paint.) |
| `packages/editor-2d/tests/smoke-e2e.test.tsx` | 4 | REWRITE the existing `'line DI: typed 5 / 30 → Esc → re-invoke L → pills show dim placeholder defaults'` scenario at lines 1296-1349 to use ArrowUp recall pill + Enter accept. The test name changes to `'line DI: typed 5 / 30 → Esc → re-invoke L → ArrowUp shows recall pill → Enter commits at recalled values'`. Old scenario contradicts the new design and must be removed (per §1.16.12 stale-symbol purge). |
| `packages/editor-2d/tests/tool-runner.test.ts` | 4 | New test: when `recallActive` is true, runner subscription's preview / dimensionGuides updates do NOT fire on cursor diff. Set up tool with previewBuilder; mount; advance cursor; assert preview shape NOT updated. (Asserts the §A16 freeze contract.) |
| `docs/operator-shortcuts.md` | 4 | **Version bump 2.1.0 → 2.2.0** (minor — adding new shortcuts per registry governance §Governance). Add ArrowUp / ArrowDown rows in the Shortcut map (under a new "Dynamic Input recall" sub-section). Add changelog entry referencing this plan. ArrowUp = "Recall last submit" (with DI active + a recall entry under the active prompt key). ArrowDown / Tab = "Cancel recall." Sole authority: ADR-023 (extended by ADR-025); no ADR-025 amendment needed (the recall is implementation-internal — see §6 Deviations). Gate `DI-P4-OperatorShortcutsVersion` enforces the version target + changelog presence. |

### 4.2 In scope — files created

None. All changes apply to existing modules per the precedent (snap-engine-extension created `intersection.ts`; this plan does not need a new module — combiner stays a single helper, runner subscription stays in `runner.ts`, router branches stay in `router.ts`).

### 4.3 Files deleted

None directly. The Round 7 Phase 2 dim-placeholder mechanic is deleted in-place (slice fields, chrome render branch, EditorRoot fallback, smoke-e2e scenario) per GR-1 clean-break.

### 4.4 Out of scope (deferred)

- **Per-field unit slot on `DynamicInputField`.** Per A6 lock, unit display is suppressed. Adding `unit?: string | { metric, imperial }` is deferred to a future ADR amendment when a config-option consumer lands. Per GR-1 (no forward-extensibility placeholders), the field is NOT added in this plan.
- **History scrolling on ArrowUp.** Per A5, ArrowUp recalls only the most recent submit. No `commandBar.dynamicInputHistory: string[][]`. If a future spec needs walking older submits, that's a separate plan with explicit user lock.
- **Cross-tab persistence.** Recall map lives only in `editorUiStore` (not IndexedDB / project-store / API). Reload clears. Same constraint as Round 7 Phase 2.
- **Light theme.** Recall pill uses dark-theme tokens only. Light-mode work tracked separately at Milestone 5.
- **Light/dark theme tokens for recall pill.** New `.recallPill` CSS class consumes the existing `canvas.transient.label_*` tokens (or a new dedicated sub-namespace) — TBD during Phase 4 implementation. No new design-tokens.md entries authored in this plan unless the implementation forces them.
- **Keyboard router multi-letter accumulator interaction.** ArrowUp / ArrowDown do not interact with `commandBar.accumulator` (separate stream).

### 4.5 Blast radius

- **Slice (`commandBar.dynamicInput`):** `placeholders[]` removed; `locked[]` added; `recallActive` added. `commandBar.dynamicInputRecall` replaces `commandBar.lastSubmittedBuffers` (rename only). Three actions added (`setDynamicInputFieldLocked`, `unlockAllDynamicInputFields`, `setDynamicInputRecallActive`). The `setDynamicInputManifest` mutator's body changes (drops placeholder seeding, adds `locked` init).
- **Chrome (`DynamicInputPills.tsx` + module CSS):** placeholder render branch removed; live-cursor render branch added; recall pill render branch added; abs-of-typed display added. Net rendering-rule count: 4 (live, typed-display, locked-display, recall-pill).
- **Combiner:** signature change; consumed by EditorRoot only (single call site at `EditorRoot.tsx:225`).
- **Tools:** `draw-rectangle.ts` numberPair commit branches drop abs() — drives correct origin derivation. `draw-line.ts` / `draw-polyline.ts` / `draw-circle.ts` / `draw-xline.ts` unchanged.
- **Tests:** `ui-state.test.ts`, `keyboard-router.test.ts`, `dynamic-input-combine.test.ts`, `DynamicInputPills.test.tsx`, `draw-tools.test.ts`, `tool-runner.test.ts`, `smoke-e2e.test.tsx` — net new tests ≈ 25; rewrites ≈ 6.
- **Operator shortcuts:** ArrowUp / ArrowDown registered.
- **No project model / extraction registry / domain schema impact.** This plan touches ONLY editor-2d UI state, chrome, tools, and tests.

### 4.6 Binding specifications touched

- **ADR-025 (DI manifest v2)** — no new ADR. The new direction-inversion semantics are an implementation refinement of `combineAs: 'point'` and `combineAs: 'numberPair'` interpretation, not a manifest contract change. ADR-025 §4 (angle-as-degrees) carries forward unchanged. ADR-025 §1-§3 (geometry contract) carries forward unchanged. The runner-freeze-during-recall is an implementation detail of the runner, not an ADR-025 contract change.
- **`docs/operator-shortcuts.md`** — additive: ArrowUp / ArrowDown entries.
- **`docs/design-tokens.md`** — possibly additive in Phase 4 (one new token if `.recallPill` needs a unique background); else no change. Decision deferred to Phase 4 implementation. If any token added, version bump per §0.5.
- **Round 7 Phase 2 plan (`docs/plans/feature/m1-3-canvas-tokens-and-di-polish.md`)** — superseded with respect to its Phase 2 dim-placeholder design. The plan file stays in `docs/plans/` as historical record; no edit needed. Phase 4 of THIS plan retires the Phase 2 mechanic in code.

## 5. Architecture Doc Impact

| Doc | Path | Change | Reason |
|-----|------|--------|--------|
| ADR-025 (DI manifest v2) | `docs/adr/025-dynamic-input-manifest-v2.md` | No change | Implementation conforms; cursor-aware combiner is a refinement, not a contract change. Per §0.6 (ADRs immutable). |
| Operator shortcuts | `docs/operator-shortcuts.md` | Version bump `2.1.0` → `2.2.0` (minor) | ArrowUp / ArrowDown entries added in Phase 4. Per ADR-023 §6 / §0.5 spec-update rule, registry entries land in the same commit as the keyboard-router code. Per registry governance ("Adding a new shortcut: minor version bump"). Gate DI-P4-OperatorShortcutsVersion enforces. |
| Design tokens | `docs/design-tokens.md` | TBD Phase 4 | If `.recallPill` requires a new token (background tint), version bump + changelog entry. Decision deferred to Phase 4. |
| Round 7 Phase 2 plan | `docs/plans/feature/m1-3-canvas-tokens-and-di-polish.md` | No change | Historical record; the dim-placeholder design is retired in code by THIS plan's Phase 4 (clean-break per GR-1). |

No new ADR is required. No existing ADR is modified. No deviation from any binding spec.

## 6. Deviations from binding specifications (§0.7)

None. Three potential candidates were considered and rejected:

1. **Adding `DynamicInputField.unit?: string`** — would be a manifest type change. Considered for A6 "reserve a unit slot" wording but rejected per GR-1 (no forward-extensibility placeholders). Future ADR amendment when a concrete consumer exists.
2. **New `Prompt.recallKey` separate from `persistKey`** — considered for B8 to decouple "what key to record under" from "what key to recall from", but the existing `persistKey` already serves both via the canonical `${toolId}:${prompt.persistKey ?? promptIndex}` derivation. No decoupling needed.
3. **New `commandBar.dynamicInputHistory: string[][]`** — considered for ArrowUp history scrolling, rejected per A5 (most-recent-only).

All three are explicit non-deviations. No user approval required.

## 7. Object Model and Extraction Integration

Not applicable. This plan touches only editor-2d UI state, chrome, tools, and tests. No object model, extraction registry, validation rule, mesh descriptor, document sync, or ownership state changes.

## 8. Hydration, Serialization, Undo/Redo, Sync

- **Hydration (document load):** unchanged. `commandBar.dynamicInputRecall` is editor-UI state, not project state; not loaded with the project document. Same as Round 7 Phase 2's `lastSubmittedBuffers`.
- **Serialization (document save):** unchanged. `commandBar.dynamicInputRecall` is not persisted; lives only in the in-memory `editorUiStore` slice.
- **Undo/Redo:** unchanged. DI buffer recording is not an undoable action (it does not mutate the project document).
- **Sync:** unchanged. No collaborative semantics for DI state.

## 4.0.1 Per-field semantics × tool matrix (canonical scope)

This is the **single source of truth** for which tools have which DI semantics post-overhaul. Done Criteria, gates, and tests reference this matrix directly.

| Tool | combineAs | Field 0 | Field 1 | B6 live source (per field) | B7 inversion (per field) | B8 recall key |
|------|-----------|---------|---------|---------------------------|--------------------------|---------------|
| draw-line | point | distance | angle | linear-dim length / angle-arc degrees | distance: signed; angle: cursor when unlocked | `draw-line:1` |
| draw-polyline | point | distance | angle | linear-dim length / angle-arc degrees | distance: signed; angle: cursor when unlocked | `draw-polyline:next-vertex` (A17) |
| draw-rectangle | numberPair | number (W) | number (H) | linear-dim length × 2 (W along bottom, H along right) | W: cursor.x sign × \|W\|; H: cursor.y sign × \|H\|; typed sign optionally flips | `draw-rectangle:1` |
| draw-circle | number | distance (Radius) | — | linear-dim length | NONE (single-field; A11) | `draw-circle:1` |
| draw-xline | angle | angle | — | angle-arc degrees | NONE (xline bidirectional; A12) | `draw-xline:1` |

**R** = required (Phase 2 / 3 / 4 deliverable per phase). **NONE** = explicitly out-of-scope inversion semantics (A11 / A12 locks).

## 4.0.2 Direction inversion formula (canonical, B7)

Per A4 + Phase 3 step 4.

### 'point' arm (line, polyline)

Inputs: `buffers = [distBuf, angleBuf]`, `cursor` (metric Point2D; may be null when no mousemove has happened yet), `anchor` (metric Point2D — line p1 / polyline last vertex).

The two field arms resolve independently — buffer non-empty wins; otherwise fall back to cursor. Per A2, lock state in chrome / router does NOT change combiner output (locked + non-empty buffer always parses the buffer; the chrome's lock-aware display does NOT alter the underlying buffer string). Backspace-on-locked produces a transient locked + empty state — combiner falls back to cursor for that field per the formula below.

```
// Resolve angleRad:
if angleBuf non-empty:
  angleRad = parseFloat(angleBuf) * Math.PI / 180
else if cursor:
  angleRad = atan2(cursor.y - anchor.y, cursor.x - anchor.x)
else:
  return null  // degenerate — no cursor + empty angle field

// Resolve distance (signed):
if distBuf non-empty:
  distance = parseFloat(distBuf)  // SIGNED — preserves negative
else if cursor:
  distance = Math.hypot(cursor.x - anchor.x, cursor.y - anchor.y)  // always positive
else:
  return null

// Compose:
output = {
  x: anchor.x + Math.cos(angleRad) * distance,
  y: anchor.y + Math.sin(angleRad) * distance,
}
return { kind: 'point', point: output }
```

**Combiner does not consume `locked` (per A19 — Rev-2 contradiction fix).** The `locked` slice flags govern chrome (suppress live read in pill display) and router (don't re-lock on Tab). The combiner consumes only `buffers` + `cursor` + `anchor`; buffer-emptiness is the sole gate for "use cursor instead of typed value." Phase 3 step 1's JSDoc documents this non-consumption explicitly.

Note that negative typed distance (`distBuf = '-5'`) naturally flips 180° via the signed multiplication — no special-case branch needed. The pill-display layer (Phase 2) shows the absolute value (per A1) but the buffer string preserves the minus.

### 'numberPair' arm (rectangle)

Inputs: `buffers = [wBuf, hBuf]`, `cursor` (metric Point2D; may be null), `anchor` (metric Point2D — rectangle corner1).

```
// Resolve W (signed):
if wBuf non-empty:
  wRaw = parseFloat(wBuf)
  // Cursor direction wins; typed sign optionally flips:
  if cursor:
    cursorSignX = (cursor.x - anchor.x) >= 0 ? 1 : -1
    typedSign = wRaw < 0 ? -1 : 1
    w = cursorSignX * typedSign * Math.abs(wRaw)
  else:
    w = wRaw  // no cursor → use typed sign as-is
else if cursor:
  w = cursor.x - anchor.x  // signed cursor delta (live numberPair)
else:
  return null

// Same for H using cursor.y:
... (mirror logic with cursor.y - anchor.y) ...

return { kind: 'numberPair', a: w, b: h }
```

The rectangle tool's `'numberPair'` commit branch drops the `Math.abs()` calls and re-derives `origin = { x: Math.min(corner1.x, corner1.x + a), y: Math.min(corner1.y, corner1.y + b) }`; primitive fields stay positive: `width = Math.abs(a); height = Math.abs(b);`.

### 'number' arm (circle radius)

UNCHANGED. `parseFloat(buffer)`; emit `{ kind: 'number', value }`. The tool's `Math.abs(edge.value)` reject-zero path handles the rest. A11 lock — single-field has no direction.

### 'angle' arm (xline direction)

UNCHANGED. `parseFloat(buffer) * Math.PI / 180`; emit `{ kind: 'angle', radians }`. A12 lock — xline bidirectional.

## 9. Implementation phases

### Phase 1 — Slice + manifest contract overhaul (no behavior change)

**Goal:** Establish the slice contract changes that B6 / B7 / B8 consume. After this phase: `commandBar.dynamicInputRecall` exists (renamed from `lastSubmittedBuffers`); `commandBar.dynamicInput.locked: boolean[]` exists (init to `Array(N).fill(false)` on manifest publish); the `placeholders: string[]` field STAYS for now (Phase 4 retires it). User-visible behavior is unchanged.

**Files affected:** see §4.1 Phase-1 rows.

**Steps:**
1. **Rename slice field** in `packages/editor-2d/src/ui-state/store.ts:166` and `:325`: `lastSubmittedBuffers` → `dynamicInputRecall`. Update the comment block at `:158-165` accordingly.
2. **Update the `recordSubmittedBuffers` action body** at `:548-552` to write into the renamed slice. Action name stays.
3. **Add `locked: boolean[]` field** to the `commandBar.dynamicInput` shape at `:133-156`. Update comment block to document the new field — "parallel to `buffers`; `true` when the field's value is frozen via Tab; live-cursor read on the pill is suppressed for locked fields."
4. **Update `setDynamicInputManifest` action body** at `:524-538`: initialize `locked: Array<boolean>(manifest.fields.length).fill(false)` parallel to `buffers`. Placeholder seeding stays for now (Phase 4 drops it) BUT the `lastSubmittedBuffers` read on `:526` MUST be renamed to `dynamicInputRecall` in this same edit (otherwise placeholder seeding breaks). Store invariant updated: `locked.length === buffers.length === manifest.fields.length`. Net diff in this action body: (a) rename the slice-read at :526, (b) add the `locked` array initialization in the immer setter.
5. **Add new mutators** to `editorUiActions`:
   ```typescript
   setDynamicInputFieldLocked(idx: number, locked: boolean): void {
     editorUiStore.setState((s) => {
       if (s.commandBar.dynamicInput && idx >= 0 && idx < s.commandBar.dynamicInput.locked.length) {
         s.commandBar.dynamicInput.locked[idx] = locked;
       }
     });
   },
   unlockAllDynamicInputFields(): void {
     editorUiStore.setState((s) => {
       if (s.commandBar.dynamicInput) {
         s.commandBar.dynamicInput.locked = s.commandBar.dynamicInput.locked.map(() => false);
       }
     });
   },
   ```
6. **Update existing tests** in `packages/editor-2d/tests/ui-state.test.ts:374-411` to reference `dynamicInputRecall` instead of `lastSubmittedBuffers`. Add new tests:
   - `setDynamicInputManifest initializes locked: [false, false] for 2-field manifest`.
   - `setDynamicInputFieldLocked(0, true) locks field 0; getState reflects`.
   - `unlockAllDynamicInputFields() resets every entry to false`.
   - `setDynamicInputFieldLocked is a no-op when dynamicInput is null`.
7. **Section-consistency pass per §1.16.12** — grep the codebase for `lastSubmittedBuffers` after rename; assert zero matches outside test files (and inside tests, only references to `dynamicInputRecall` remain after Step 6).

**Phase 1 mandatory completion gates:**

| Gate | Command | Expected |
|------|---------|----------|
| DI-P1-NoLastSubmittedBuffersRef | `rg -n "lastSubmittedBuffers" packages/editor-2d/src packages/editor-2d/tests` | zero matches (everything renamed to `dynamicInputRecall`) |
| DI-P1-RenamedFieldExists | `rg -n "^\s*dynamicInputRecall:" packages/editor-2d/src/ui-state/store.ts` | exactly 2 matches in `store.ts` (interface field declaration line + initial state line). [§3.10 patch 2026-05-01: regex tightened from `rg -n "dynamicInputRecall"` after Phase 1 execution discovered the un-anchored regex picks up JSDoc + body reads, producing 8 matches; the slice-shape contract under enforcement is the 2 declarative sites only. `-E` flag dropped — local rg build interprets it as encoding; rg is extended-regex by default.] |
| DI-P1-LockFieldExists | `rg -n "locked: boolean\[\]" packages/editor-2d/src/ui-state/store.ts` | exactly 1 match (in `dynamicInput` interface) |
| DI-P1-LockMutatorExists | `rg -n "setDynamicInputFieldLocked\|unlockAllDynamicInputFields" packages/editor-2d/src/ui-state/store.ts` | exactly 2 matches (one declaration line per action) |
| DI-P1-Typecheck | `pnpm typecheck` | exit code 0; zero TypeScript errors |
| DI-P1-Lint | `pnpm check` | exit code 0; zero biome errors |
| DI-P1-Tests | `pnpm --filter @portplanner/editor-2d test` | exit code 0; all tests pass; final test count = baseline + 4 (the 4 net-new mutator + slice tests added in step 6) |

**Phase 1 invariants introduced:**
- **I-DI-1** — slice shape invariant: when `commandBar.dynamicInput !== null`, `locked.length === buffers.length === placeholders.length === manifest.fields.length`. Enforcement: `setDynamicInputManifest` always initializes all four arrays at the same length; mutators can only update single indices.

### Phase 2 — B6 Live cursor pill values

**Goal:** Empty unlocked pills show live cursor-derived values (e.g., `Distance: 6.282`, `Angle: 32.91`) updating per cursor frame. Once the user types, the typed buffer replaces the live value.

**Files affected:** see §4.1 Phase-2 rows.

**Steps:**
1. **Add `deriveLivePillValue` helper** at the top of `DynamicInputPills.tsx`:
   ```typescript
   function deriveLivePillValue(guide: DimensionGuide): string {
     switch (guide.kind) {
       case 'linear-dim': {
         const len = Math.hypot(guide.anchorB.x - guide.anchorA.x, guide.anchorB.y - guide.anchorA.y);
         return len.toFixed(3);
       }
       case 'angle-arc': {
         const deg = guide.sweepAngleRad * 180 / Math.PI;
         return deg.toFixed(2);
       }
     }
   }
   ```
   Single argument: the guide carries everything needed (kind + numeric inputs). Per GR-1, no unused parameters; the helper does not take a `fieldKind` argument because the field-kind → format mapping is bijective with `guide.kind` for the current 5-tool matrix (`'distance'` field always pairs with `'linear-dim'` guide; `'angle'` field always pairs with `'angle-arc'` guide; `'number'` field for W/H pairs with `'linear-dim'`). Per A6, NO unit suffix.
2. **Update the multi-pill render branch** in `DynamicInputPills.tsx:64-100` to compute `valueText` per field. The render-path priority is `(buffer non-empty → typed display)` > `(locked → empty)` > `(live cursor read)`:
   ```typescript
   const buffer = dynamicInput.buffers[idx] ?? '';
   const isLocked = dynamicInput.locked[idx] ?? false;
   let valueText: string;
   if (buffer.length > 0) {
     // A1: pill displays absolute value of typed buffer.
     valueText = buffer.startsWith('-') ? buffer.slice(1) : buffer;
   } else if (isLocked) {
     // Empty + locked: degenerate edge case (e.g., user types, Tabs to lock,
     // then Backspaces back to empty — see §13 risk row). Pill renders empty
     // value (label only); user can re-type and lock stays on.
     valueText = '';
   } else {
     // Empty + unlocked: live cursor read (B6).
     valueText = deriveLivePillValue(guide);
   }
   const text = `${labelPrefix}${valueText}`;
   ```
   Phase 2 also REMOVES the `placeholders[idx]` read at line 79 (the existing `dynamicInput.placeholders[idx] ?? ''` lookup) — live + typed-display fully cover the empty-pill state. The `pillPlaceholder` style class + `data-pill-placeholder` attribute become dead code in Phase 2 (no render path applies them) and are deleted in Phase 4. The `placeholders: string[]` slice field stays in the type until Phase 4 (Phase 1 deferred its removal to keep contract+behavior-loss in one phase rather than spreading across two).
3. **Update tests in `DynamicInputPills.test.tsx`**:
   - New test: `pill shows live distance from linear-dim guide when buffer empty + unlocked` — set up manifest + dimensionGuide with anchorA=(0,0) anchorB=(3, 4); cursor at (3,4); assert pill text contains `5.000`.
   - New test: `pill shows live angle in degrees from angle-arc guide` — set up angle-arc with sweepAngleRad = π/4; assert pill text contains `45.00`.
   - New test: `pill shows typed buffer overriding live (abs value)` — set buffer to `-7`; assert pill text contains `7` and not `-7`.
   - New test: `pill empty + locked stays empty` — set buffer = '', locked = true; assert pill text has no numeric value (label only).
   - New tests for distance pill format with 3 decimals; angle pill format with 2 decimals.
4. **Smoke-e2e test** — extend the existing line-DI smoke scenario (`tests/smoke-e2e.test.tsx`) to include a `mouseMove` after manifest publish; assert pill text reflects live distance + angle. (No new scenario file; one new `it()` in the existing describe.)

**Phase 2 mandatory completion gates:**

| Gate | Command | Expected |
|------|---------|----------|
| DI-P2-LiveHelperExists | `rg -n "function deriveLivePillValue" packages/editor-2d/src/chrome/DynamicInputPills.tsx` | 1 match |
| DI-P2-NoPlaceholderRead | `rg -n "placeholders\[idx\]\|placeholders\[i\]\|dynamicInput.placeholders" packages/editor-2d/src/chrome/DynamicInputPills.tsx` | zero matches (Phase 2 stops reading the placeholder slice; Phase 4 deletes the slice field) |
| DI-P2-LiveDistanceTest | `pnpm --filter @portplanner/editor-2d test -- DynamicInputPills.test.tsx -t "live distance"` | passes; pill text includes `5.000` |
| DI-P2-LiveAngleTest | `pnpm --filter @portplanner/editor-2d test -- DynamicInputPills.test.tsx -t "live angle"` | passes; pill text includes `45.00` |
| DI-P2-AbsDisplayTest | `pnpm --filter @portplanner/editor-2d test -- DynamicInputPills.test.tsx -t "abs"` | passes; typed `-7` renders `7` |
| DI-P2-Typecheck | `pnpm typecheck` | exit code 0; zero TypeScript errors |
| DI-P2-Lint | `pnpm check` | exit code 0; zero biome errors |
| DI-P2-Tests | `pnpm --filter @portplanner/editor-2d test` | exit code 0; all tests pass; final test count = post-Phase-1 baseline + 6 (the 6 net-new live-cursor + abs-display tests added in step 3) |

**Phase 2 invariants introduced:**
- **I-DI-2** — pill display SSOT: `valueText` is computed from `(buffers[idx], locked[idx], dimensionGuides[idx], field.kind)` with NO read of `placeholders[idx]`. Enforcement: gate DI-P2-NoPlaceholderRead.

### Phase 3 — B7 Tab lock + direction inversion

**Goal:** Tab on a typed field freezes it. All-locked auto-submits. Two-step Esc unlocks-then-aborts. Combiner becomes cursor-aware (per A19, single new param); direction-inversion formulas per §4.0.2 land. Rectangle's signed-numberPair commit produces correct origin in any quadrant.

**Files affected:** see §4.1 Phase-3 rows.

**Steps:**
1. **Combiner signature change** in `packages/editor-2d/src/tools/dynamic-input-combine.ts:38-42`:
   ```typescript
   export function combineDynamicInputBuffers(
     manifest: DynamicInputManifest,
     buffers: string[],
     anchor: Point2D,
     cursor: Point2D | null,
   ): Input | null { ... }
   ```
   Per-arm logic per §4.0.2. JSDoc updated to document the new parameter (cursor: most recent canvas cursor metric; null when no mousemove yet — combiner falls back to typed-only semantics if every required buffer is non-empty, else returns null). The `locked` slice field is NOT threaded into the combiner per A19.
2. **Update `EditorRoot.onSubmitDynamicInput`** at `EditorRoot.tsx:198-259` to thread `cursor` (from `editorUiStore.getState().overlay.lastKnownCursor`) into `combineDynamicInputBuffers` as the 4th arg. `lastKnownCursor` is the captured-on-mousemove field that's never cleared (per `setLastKnownCursor` action), so it survives the user moving onto the command bar. Keep the existing `effectiveBuffers` placeholder fallback path for now (Phase 4 drops it).
3. **Router Tab-handler extension** in `packages/editor-2d/src/keyboard/router.ts:222-230`:
   ```typescript
   if (key === 'Tab') {
     const di = editorUiStore.getState().commandBar.dynamicInput;
     if (di && di.manifest.fields.length > 0) {
       e.preventDefault();
       const idx = di.activeFieldIdx;
       const buffer = di.buffers[idx] ?? '';
       if (buffer.length > 0 && !di.locked[idx]) {
         editorUiActions.setDynamicInputFieldLocked(idx, true);
       }
       // Cycle navigation only if multi-field:
       if (di.manifest.fields.length > 1) {
         cycleDIActiveField(e.shiftKey ? -1 : 1);
       }
       // Auto-submit when all fields locked (A18):
       const updatedDi = editorUiStore.getState().commandBar.dynamicInput;
       if (updatedDi && updatedDi.locked.every(Boolean)) {
         callbacks.onSubmitDynamicInput(updatedDi.manifest, updatedDi.buffers);
       }
       return;
     }
   }
   ```
4. **Router Esc-handler two-step** at `router.ts:205-216`:
   ```typescript
   if (key === 'Escape') {
     // Phase 4 will add the recallActive branch FIRST (before locked).
     // Phase 3 only adds the locked branch:
     const di = editorUiStore.getState().commandBar.dynamicInput;
     if (di && di.locked.some(Boolean)) {
       editorUiActions.unlockAllDynamicInputFields();
       return;
     }
     // Existing abort path (clearAccumulator + setInputBuffer + clearDynamicInput + ...):
     clearAccumulator();
     editorUiActions.setInputBuffer('');
     editorUiActions.clearDynamicInput();
     callbacks.onAbortCurrentTool();
     editorUiActions.setFocusHolder('canvas');
     return;
   }
   ```
5. **Drop `Math.abs` in `draw-rectangle.ts`**:
   - Lines 128-144 (primary numberPair branch): re-derive `origin = { x: Math.min(corner1.x, corner1.x + c1.a), y: Math.min(corner1.y, corner1.y + c1.b) }`; `width = Math.abs(c1.a); height = Math.abs(c1.b);`. Zero-reject (`width === 0 || height === 0`) preserved.
   - Lines 101-123 (F3 [Dimensions] sub-flow): same — drop `Math.abs(dims.a)` / `Math.abs(dims.b)` in favor of signed delta + min-corner derivation.
6. **Tests:**
   - `dynamic-input-combine.test.ts`: 6 new test cases — line/polyline `'point'` arm × cursor-Q3 + typed Distance=5 + empty Angle (combiner uses cursor for angle); typed Distance=-5 + empty Angle (signed distance, cursor-derived angle); typed Distance=5 + typed Angle=30 (both buffer-driven, cursor unused); rectangle `'numberPair'` × cursor right-down + typed W=-5 (W extends left); circle `'number'` × negative buffer (combiner returns negative; tool's abs handles); xline `'angle'` × negative buffer (combiner handles). Note: tests do NOT pass `locked` to the combiner (per A19 the combiner has no such parameter); test scenarios that simulate "locked at typed value" do so by simply passing the typed buffer — the slice's lock state is irrelevant to combiner output.
   - `keyboard-router.test.ts`: 4 new tests — Tab on typed → lock; Tab on empty → no lock, just navigate; all-locked → auto-submit fires onSubmitDynamicInput callback; Esc with locked → unlock; Esc with no locked → abort.
   - `draw-tools.test.ts`: 4 new tests — rectangle commit-from-numberPair × four quadrant cases (signed W/H produces correct origin).
7. **Section-consistency** — grep for any lingering `Math.abs(c1.a)` / `Math.abs(c1.b)` outside the deletion sites.

**Phase 3 mandatory completion gates:**

| Gate | Command | Expected |
|------|---------|----------|
| DI-P3-CombinerSignature | `rg -n "cursor: Point2D \| null" packages/editor-2d/src/tools/dynamic-input-combine.ts` | 1 match (signature) |
| DI-P3-CombinerNoLockedParam | `rg -n "^\s*locked\s*:" packages/editor-2d/src/tools/dynamic-input-combine.ts` | zero matches (combiner has no `locked: boolean[]` parameter declaration per A19; un-anchored `locked` references in JSDoc are intentional negative framing per §1.16.12 bucket-b). [§3.10 patch 2026-05-01: regex tightened from un-anchored `rg -n "locked"` after Phase 3 discovered the JSDoc explicitly states "the `locked` slice field is NOT a parameter here".] |
| DI-P3-RectAbsRemoved | `rg -n "origin:\s*corner1\b" packages/editor-2d/src/tools/draw/draw-rectangle.ts` | zero matches in numberPair commit branches (signed numberPair derives origin via min-corner; the literal `origin: corner1` would be the OLD pre-Phase-3 pattern. The retained `width: Math.abs(c1.a), height: Math.abs(c1.b)` at the addPrimitive site is intentional — primitive fields stay positive per A19 / I-DI-7). [§3.10 patch 2026-05-01: regex retargeted from `Math\.abs\(c1\.a\)` after Phase 3 discovered that pattern over-matches the legitimate retained abs at the addPrimitive site; the actual invariant being enforced is "origin derived from min-corner, not corner1 directly".] |
| DI-P3-TabLocksOnTyped | `pnpm --filter @portplanner/editor-2d test -- keyboard-router.test.ts -t "Tab.*typed.*lock"` | passes |
| DI-P3-TabEmptyNoLock | `pnpm --filter @portplanner/editor-2d test -- keyboard-router.test.ts -t "Tab.*empty"` | passes |
| DI-P3-AutoSubmitAllLocked | `pnpm --filter @portplanner/editor-2d test -- keyboard-router.test.ts -t "all.*locked"` | passes; onSubmitDynamicInput fires |
| DI-P3-EscTwoStep | `pnpm --filter @portplanner/editor-2d test -- keyboard-router.test.ts -t "Esc.*two-step\|Esc.*unlock"` | passes |
| DI-P3-PointInversionQ3 | `pnpm --filter @portplanner/editor-2d test -- dynamic-input-combine.test.ts -t "Q3"` | passes; cursor in Q3 + typed Distance=5 produces point in Q3 |
| DI-P3-NumberPairCursorWins | `pnpm --filter @portplanner/editor-2d test -- dynamic-input-combine.test.ts -t "numberPair.*cursor"` | passes |
| DI-P3-RectAllQuadrants | `pnpm --filter @portplanner/editor-2d test -- draw-tools.test.ts -t "rectangle.*quadrant"` | 4 quadrant cases pass |
| DI-P3-Typecheck | `pnpm typecheck` | exit code 0; zero TypeScript errors |
| DI-P3-Lint | `pnpm check` | exit code 0; zero biome errors |
| DI-P3-Tests | `pnpm --filter @portplanner/editor-2d test` | exit code 0; all tests pass; final test count = post-Phase-2 baseline + 14 (6 inversion-fixture combiner tests + 4 Tab/Esc router tests + 4 rectangle quadrant tool tests) |

**Phase 3 invariants introduced:**
- **I-DI-3** — combiner cursor-awareness: `combineDynamicInputBuffers` reads `cursor` for `'point'` and `'numberPair'` arms when buffers are empty; `'number'` and `'angle'` arms ignore cursor (A11 / A12). The combiner does NOT read `locked` per A19. Enforcement: gates DI-P3-CombinerSignature + DI-P3-CombinerNoLockedParam + dynamic-input-combine.test.ts cases.
- **I-DI-4** — Tab-on-typed locks invariant: Tab transitions a typed field's `locked[idx]` from false to true (idempotent if already true). Tab on empty does NOT mutate `locked`. Enforcement: gate DI-P3-TabLocksOnTyped + DI-P3-TabEmptyNoLock.
- **I-DI-5** — auto-submit on all-locked: when Tab transitions the last unlocked field with a typed buffer to locked, AND `every(locked)` is true, the router fires `onSubmitDynamicInput` exactly once. Enforcement: gate DI-P3-AutoSubmitAllLocked.
- **I-DI-6** — two-step Esc: `Esc` with any field locked unlocks all (does NOT abort). `Esc` with no field locked aborts (existing path). Enforcement: gate DI-P3-EscTwoStep.
- **I-DI-7** — signed numberPair commit: rectangle commit branches do NOT call `Math.abs()` on `c1.a` / `c1.b` / `dims.a` / `dims.b`; origin is min-corner derivation. Enforcement: gate DI-P3-RectAbsRemoved.

### Phase 4 — B8 Arrow Up recall pill + retire Round 7 Phase 2 placeholder design

**Goal:** ArrowUp shows a recall pill at the cursor with the most-recent submit for the prompt key. Enter / Space accepts; Tab / ArrowDown cancels. Rubber-band (preview + dimensionGuides) freezes while recall is active. The Round 7 Phase 2 dim-placeholder mechanic is fully retired — slice fields, chrome render branch, EditorRoot fallback, smoke-e2e scenario all dropped.

**Files affected:** see §4.1 Phase-4 rows.

**Steps:**
1. **Slice changes** in `store.ts`:
   - Drop `placeholders: string[]` from `commandBar.dynamicInput` shape (`:155`).
   - Add `recallActive: boolean` to the same shape; init `false` in `setDynamicInputManifest` (`:524-538`).
   - Drop the `persisted` lookup + `placeholders` initialization in `setDynamicInputManifest`.
   - Add `setDynamicInputRecallActive(active: boolean)` mutator.
2. **EditorRoot cleanup** at `EditorRoot.tsx:213-256`: drop the `placeholders` lookup + `effectiveBuffers` map. Combine raw `buffers` directly with the 4-arg signature locked in A19 (combiner has NO `locked` parameter):
   ```typescript
   const input = combineDynamicInputBuffers(
     manifest,
     buffers,                    // raw, not effectiveBuffers
     anchor ?? { x: 0, y: 0 },
     cursor,                     // editorUiStore.getState().overlay.lastKnownCursor; threaded through in Phase 3 step 2
   );
   ```
   The history append still uses `buffers`. The `recordSubmittedBuffers` call writes raw buffers (post-combiner success).
3. **DynamicInputPills cleanup** at `DynamicInputPills.tsx:79-99`:
   - Drop `placeholder` lookup, `showPlaceholder` ternary, `placeholderClass`, `data-pill-placeholder` attribute.
   - The Phase 2 live-value branch is the only render path for empty unlocked pills now.
4. **DynamicInputPills recall pill** in `DynamicInputPills.tsx`:
   - When `dynamicInput.recallActive === true`:
     - Apply `pillDimmed` style class to every per-field pill (overrides the focused/unfocused style).
     - Render a new `<div className={styles.recallPill}>` at `cursor.screen + (16, 28)` per A13.
     - Recall pill text: read `dynamicInputRecall[promptKey]` (where `promptKey = dynamicInput.promptKey`); format as `${manifest.fields[i].label}=${value}` joined ` / ` per A14.
     - If `dynamicInputRecall[promptKey]` is absent (shouldn't happen — router only sets `recallActive` when an entry exists — but defensive), don't render the recall pill (graceful degradation).
5. **Router ArrowUp + ArrowDown** in `router.ts`:
   ```typescript
   if (key === 'ArrowUp' && focus === 'canvas') {
     const di = editorUiStore.getState().commandBar.dynamicInput;
     if (!di) return; // no DI active → pass through
     const recall = editorUiStore.getState().commandBar.dynamicInputRecall[di.promptKey];
     if (!recall || recall.length === 0) return; // no entry → pass through (or no-op)
     e.preventDefault();
     editorUiActions.setDynamicInputRecallActive(true);
     return;
   }
   if (key === 'ArrowDown' && focus === 'canvas') {
     const di = editorUiStore.getState().commandBar.dynamicInput;
     if (di?.recallActive) {
       e.preventDefault();
       editorUiActions.setDynamicInputRecallActive(false);
       return;
     }
   }
   ```
6. **Router Tab/Esc/Enter/Space recallActive branches**:
   - Tab handler (Phase 3) — at top, before the lock-or-cycle branch: `if (di?.recallActive) { e.preventDefault(); editorUiActions.setDynamicInputRecallActive(false); return; }`.
   - Esc handler (Phase 3) — at top, before the unlock branch: `if (di?.recallActive) { editorUiActions.setDynamicInputRecallActive(false); return; }`. Now Esc precedence is: recall > unlock > abort.
   - Enter handler (canvas focus + tool active + DI) — at top, before the standard DI submit: `if (di.recallActive) { const recall = state.commandBar.dynamicInputRecall[di.promptKey]; callbacks.onSubmitDynamicInput(di.manifest, recall ?? di.buffers); return; }`.
   - Space handler — symmetric.
7. **Runner subscription freeze** in `runner.ts:67-89`:
   ```typescript
   editorUiStore.subscribe((state: EditorUiState) => {
     // Phase 4 — freeze preview + dimensionGuides while recall is active.
     // The recall pill freezes the rubber-band per A16.
     if (state.commandBar.dynamicInput?.recallActive === true) return;
     const cursor = state.overlay.cursor;
     // ... existing body ...
   });
   ```
8. **Smoke-e2e rewrite** at `smoke-e2e.test.tsx:1296-1349`: rename test from `'... pills show dim placeholder defaults'` to `'... ArrowUp shows recall pill → Enter commits at recalled values'`. Body: type 5/Tab/3/0/Enter to submit first line; re-invoke L; click p1; mouseMove; press ArrowUp; assert recall pill present with text `Distance=5 / Angle=30`; assert per-field pills have `pillDimmed` class; assert preview shape unchanged after subsequent mouseMove (rubber-band freeze); press Enter; assert second line committed with same Distance=5 / Angle=30 vector.
9. **Operator shortcuts registry** — bump `docs/operator-shortcuts.md` from `2.1.0` to `2.2.0` (minor — adding new shortcuts per registry governance §Governance) and add the ArrowUp / ArrowDown entries (Rev-2 H1 explicit version target):
   - **Version field** (line 3 of the file): `**Version:** 2.1.0` → `**Version:** 2.2.0`.
   - **Date field** (line 4 of the file): bump to commit date.
   - **Shortcut map** — add a new "Dynamic Input recall" sub-section with two rows:
     ```
     | ArrowUp   | dynamic-input-recall-show     | DI active + prior submit | Show recall pill at cursor with most-recent submit values |
     | ArrowDown | dynamic-input-recall-cancel   | DI recall pill active    | Cancel recall, return to live-cursor pill mode             |
     ```
   - **Changelog table** — prepend a new row at the top:
     ```
     | 2.2.0 | <commit-date> | Add `ArrowUp` → DI recall-pill show + `ArrowDown` → recall cancel (canvas focus when `commandBar.dynamicInput.manifest !== null` AND `commandBar.dynamicInputRecall[promptKey]` non-empty). M1.3 Round 7 backlog B8 — see plan `docs/plans/feature/m1-3-di-pipeline-overhaul.md`. **Minor bump** per registry governance ("Adding a new shortcut: minor version bump"). |
     ```
   Gates DI-P4-OperatorShortcutsVersion + DI-P4-OperatorShortcutsArrowUpEntry assert presence.
10. **Section-consistency pass per §1.16.12** — grep for `placeholders` (slice field) post-deletion; assert zero matches in src; only matches in test files are removals or in the (one) Phase 1 slice-shape test that asserts the field is gone.

**Phase 4 mandatory completion gates:**

| Gate | Command | Expected |
|------|---------|----------|
| DI-P4-PlaceholdersDropped | `rg -n "placeholders\s*:\s*string\[\]" packages/editor-2d/src` | zero matches (slice field gone) |
| DI-P4-RecallActiveExists | `rg -n "recallActive" packages/editor-2d/src/ui-state/store.ts` | exactly 2 matches in `store.ts` (interface field declaration + initial state line in `setDynamicInputManifest`) |
| DI-P4-RecallActionExists | `rg -n "setDynamicInputRecallActive" packages/editor-2d/src/ui-state/store.ts` | 1 match |
| DI-P4-ArrowUpHandler | `rg -n "key === 'ArrowUp'" packages/editor-2d/src/keyboard/router.ts` | 1 match |
| DI-P4-ArrowDownHandler | `rg -n "key === 'ArrowDown'" packages/editor-2d/src/keyboard/router.ts` | 1 match |
| DI-P4-RunnerFreezeActive | `rg -n "recallActive === true" packages/editor-2d/src/tools/runner.ts` | 1 match (subscription short-circuit) |
| DI-P4-PillRecallRender | `pnpm --filter @portplanner/editor-2d test -- DynamicInputPills.test.tsx -t "recall.*pill"` | passes; recall pill rendered with correct text |
| DI-P4-RouterArrowUp | `pnpm --filter @portplanner/editor-2d test -- keyboard-router.test.ts -t "ArrowUp"` | passes; recallActive set to true |
| DI-P4-RouterArrowDown | `pnpm --filter @portplanner/editor-2d test -- keyboard-router.test.ts -t "ArrowDown"` | passes; recallActive set to false |
| DI-P4-EscPrecedence | `pnpm --filter @portplanner/editor-2d test -- keyboard-router.test.ts -t "Esc.*recall.*precedence\|Esc.*two-step.*recall"` | passes; recall cancellation beats unlock |
| DI-P4-FreezeRubberBand | `pnpm --filter @portplanner/editor-2d test -- tool-runner.test.ts -t "recall.*freeze\|freeze.*recall"` | passes; preview not updated when recallActive |
| DI-P4-SmokeRecallPill | `pnpm --filter @portplanner/editor-2d test -- smoke-e2e.test.tsx -t "ArrowUp shows recall pill"` | passes; second line committed at recalled values |
| DI-P4-NoStaleSmokeScenario | `rg -n "data-pill-placeholder='true'\|data-pill-placeholder=\"true\"\|dim placeholder defaults" packages/editor-2d/tests` | zero matches (old smoke scenario fully replaced) |
| DI-P4-NoStalePillReads | `rg -n "dynamicInput\.placeholders\|placeholders\[idx\]\|placeholders\[i\]" packages/editor-2d/src` | zero matches |
| DI-P4-NoStaleStyleClass | `rg -n "pillPlaceholder\|\.pillPlaceholder" packages/editor-2d/src/chrome` | zero matches |
| DI-P4-OperatorShortcutsVersion (Rev-2 H1) | `rg -n "^\*\*Version:\*\* 2\.2\.0" docs/operator-shortcuts.md && rg -n "^\| 2\.2\.0 \|" docs/operator-shortcuts.md` | both succeed (header bumped + changelog row exists) |
| DI-P4-OperatorShortcutsArrowUpEntry (Rev-2 H1) | `rg -n "ArrowUp.*dynamic-input-recall\|dynamic-input-recall.*ArrowUp" docs/operator-shortcuts.md` | exactly 1 match (the new ArrowUp row in the Shortcut map under the "Dynamic Input recall" sub-section added in Phase 4 step 9) |
| DI-P4-NoDIFieldsInPersistence-Domain (Rev-3 H2 expanded) | `rg -n "dynamicInputRecall\|dynamicInput\.locked\|dynamicInput\.recallActive\|recallActive" packages/domain/src/serialize.ts packages/domain/src/schemas/` | zero matches (domain layer: serialize.ts + project + primitive + layer + grid + ownership + operation + object + coordinate-system schemas) |
| DI-P4-NoDIFieldsInPersistence-ProjectStore (Rev-3 H2 expanded) | `rg -n "dynamicInputRecall\|dynamicInput\.locked\|dynamicInput\.recallActive\|recallActive" packages/project-store/src/` | zero matches (project-store: store.ts, actions.ts + actions/ folder, operation-emit.ts, initial-state.ts, index.ts) |
| DI-P4-NoDIFieldsInPersistence-OperationEmit (Rev-3 H2 expanded) | `rg -n "editorUiStore\|commandBar" packages/project-store/src/operation-emit.ts packages/project-store/src/actions.ts` | zero matches (operation log / undo-redo never reads editor-UI state — confirms GR-3 module isolation per ADR-015) |
| DI-P4-NoEditorUiCrossImport (Rev-3 H2 expanded) | `rg -n "from '\.\./\.\./editor-2d\|from '@portplanner/editor-2d" packages/domain/src packages/project-store/src` | zero matches (no upstream package imports editor-UI state — architectural barrier ensures DI fields cannot reach persistence) |
| DI-P4-Typecheck | `pnpm typecheck` | exit code 0; zero TypeScript errors |
| DI-P4-Lint | `pnpm check` | exit code 0; zero biome errors |
| DI-P4-Tests | `pnpm --filter @portplanner/editor-2d test` | exit code 0; all tests pass; final test count = post-Phase-3 baseline + 8 net-new (2 ArrowUp/ArrowDown router + 2 Esc-precedence router + 2 recall-pill render + 1 freeze-during-recall runner + 1 smoke-e2e recall scenario) − 6 deleted (the Round 7 Phase 2 placeholder smoke + ui-state placeholder-seeding tests). Net delta: +2 from post-Phase-3 baseline. |

**Phase 4 invariants introduced:**
- **I-DI-8** — recall map name SSOT: the slice field is `commandBar.dynamicInputRecall`, NOT `lastSubmittedBuffers`. Enforcement: gate DI-P1-NoLastSubmittedBuffersRef (set in Phase 1).
- **I-DI-9** — placeholder design retired: `commandBar.dynamicInput.placeholders` does not exist; `pillPlaceholder` style class is not in CSS; `data-pill-placeholder` attribute is not rendered; EditorRoot's effective-buffer placeholder fallback path is gone. Enforcement: gates DI-P4-PlaceholdersDropped + DI-P4-NoStalePillReads + DI-P4-NoStaleStyleClass + DI-P4-NoStaleSmokeScenario.
- **I-DI-10** — recall pill is the sole recall-presentation surface: when `recallActive === true`, exactly one recall pill is rendered (at cursor + (16, 28)) AND per-field pills are dimmed (style class `pillDimmed` applied). Enforcement: gate DI-P4-PillRecallRender.
- **I-DI-11** — rubber-band freeze: while `recallActive === true`, the runner's subscription does NOT update `overlay.previewShape` or `overlay.dimensionGuides`. Enforcement: gate DI-P4-FreezeRubberBand.
- **I-DI-12** — Esc precedence (post-Phase-4): recallActive cancellation > locked unlock > abort tool. Enforcement: gate DI-P4-EscPrecedence (overrides I-DI-6 from Phase 3).
- **I-DI-13 (Rev-2 H2; Rev-3 expanded scope)** — DI state is editor-UI-only; never persisted to project. The DI-specific strings (`dynamicInputRecall`, `dynamicInput.locked`, `dynamicInput.recallActive`) do NOT appear in any persistence-adjacent surface: domain layer (`packages/domain/src/serialize.ts` + `packages/domain/src/schemas/`), project-store (`packages/project-store/src/` including `store.ts`, `actions.ts`, `actions/` folder, `operation-emit.ts`, `initial-state.ts`, `index.ts`). Architectural reinforcement: project-store / domain do NOT import from editor-2d (GR-3 module isolation per ADR-015). Enforcement: 4 gates DI-P4-NoDIFieldsInPersistence-{Domain, ProjectStore, OperationEmit, NoEditorUiCrossImport}.
- **I-DI-14 (Rev-2 H1)** — operator-shortcuts.md governance discipline: the registry version bumps from `2.1.0` to `2.2.0` (minor — adding new shortcuts) in the same commit as the router code that adds ArrowUp / ArrowDown handlers; a changelog entry referencing this plan is present. Enforcement: gates DI-P4-OperatorShortcutsVersion + DI-P4-OperatorShortcutsArrowUpEntry.

## 10. Invariants summary

Consolidated from Phases 1-4. Every invariant has an enforcement gate or test reference.

| ID | Invariant | Phase | Enforcement |
|----|-----------|-------|-------------|
| I-DI-1 | Slice arity invariant: `locked.length === buffers.length === manifest.fields.length` (and during Phases 1-3, also `placeholders.length`) | 1 | `setDynamicInputManifest` initializer + ui-state.test.ts |
| I-DI-2 | Pill display SSOT: `valueText` from `(buffers[idx], locked[idx], dimensionGuides[idx], field.kind)`; never reads `placeholders[idx]` | 2 | gate DI-P2-NoPlaceholderRead |
| I-DI-3 | Combiner cursor-awareness: `'point'` / `'numberPair'` arms read `cursor` when buffer empty; `'number'` / `'angle'` arms ignore cursor; combiner does not read `locked` (per A19) | 3 | gates DI-P3-CombinerSignature + DI-P3-CombinerNoLockedParam + dynamic-input-combine.test.ts |
| I-DI-4 | Tab-on-typed locks; Tab-on-empty navigates only | 3 | gate DI-P3-TabLocksOnTyped + DI-P3-TabEmptyNoLock |
| I-DI-5 | Auto-submit when `every(locked)` becomes true | 3 | gate DI-P3-AutoSubmitAllLocked |
| I-DI-6 | Two-step Esc (locked → unlock; else abort) | 3 (refined by I-DI-12 in 4) | gate DI-P3-EscTwoStep |
| I-DI-7 | Signed numberPair commit (no `Math.abs` on `c1.a` / `c1.b`) | 3 | gate DI-P3-RectAbsRemoved |
| I-DI-8 | Recall map name SSOT: `dynamicInputRecall` (renamed) | 1 | gate DI-P1-NoLastSubmittedBuffersRef |
| I-DI-9 | Placeholder design retired | 4 | gate DI-P4-PlaceholdersDropped + DI-P4-NoStalePillReads + DI-P4-NoStaleStyleClass + DI-P4-NoStaleSmokeScenario |
| I-DI-10 | Recall pill is sole recall surface (per-field pills dimmed) | 4 | gate DI-P4-PillRecallRender |
| I-DI-11 | Rubber-band freezes while recallActive | 4 | gate DI-P4-FreezeRubberBand |
| I-DI-12 | Esc precedence: recall > unlock > abort | 4 | gate DI-P4-EscPrecedence |
| I-DI-13 (Rev-2 H2; Rev-3 expanded) | DI state never persisted to project — domain + project-store + operation-emit all clean; no cross-package import from editor-2d into upstream packages | 4 | gates DI-P4-NoDIFieldsInPersistence-{Domain, ProjectStore, OperationEmit, NoEditorUiCrossImport} |
| I-DI-14 (Rev-2 H1) | operator-shortcuts.md version bumped 2.1.0 → 2.2.0 + changelog entry | 4 | gates DI-P4-OperatorShortcutsVersion + DI-P4-OperatorShortcutsArrowUpEntry |

## 11. Test strategy

**Existing tests modified:** `ui-state.test.ts` (Phase 1 — rename refs + lock mutator coverage), `DynamicInputPills.test.tsx` (Phase 2 — live render + abs display; Phase 4 — recall pill + drop placeholder tests), `dynamic-input-combine.test.ts` (Phase 3 — signature + inversion cases), `keyboard-router.test.ts` (Phase 3 — Tab lock + Esc two-step; Phase 4 — ArrowUp / ArrowDown / recall precedence), `draw-tools.test.ts` (Phase 3 — rectangle quadrants), `tool-runner.test.ts` (Phase 4 — freeze), `smoke-e2e.test.tsx` (Phase 4 — rewrite the line-DI-recall scenario).

**Net-new test count target:** ≈ 32 (4 Phase 1 + 6 Phase 2 + 14 Phase 3 + 8 Phase 4).

**Tests not added (out of scope per §4.4):**
- Per-field unit display (deferred per A6).
- ArrowUp history scrolling (deferred per A5).
- Cross-tab persistence / IndexedDB recall (out of scope).

**Coverage target:** the §4.0.1 matrix has 5 tools × ≤2 fields × 4 phases. Phase-3 inversion fixtures cover line/polyline (point arm) + rectangle (numberPair arm). Phase-2 live-value fixtures cover linear-dim + angle-arc guide kinds (which together span all 5 tools' guide configs). Phase-4 recall-pill fixture covers line; polyline / rectangle / circle / xline recall behavior is identical structurally (same router-driven setRecallActive path; different promptKey only) and is asserted by ui-state.test.ts unit-level tests on the slice + a single representative smoke-e2e scenario for line.

## 12. Done Criteria

References §4.0.1 per-field semantics matrix as the canonical scope statement.

- [ ] **Phase 1 — slice + manifest contract overhaul.** `lastSubmittedBuffers` renamed to `dynamicInputRecall` everywhere (gate DI-P1-NoLastSubmittedBuffersRef). `locked: boolean[]` field exists and initializes to `Array(N).fill(false)` (gate DI-P1-LockFieldExists + DI-P1-LockMutatorExists). All existing ui-state tests pass (renamed refs); new mutator tests pass.
- [ ] **Phase 2 — B6 live cursor.** Empty unlocked pills show `deriveLivePillValue(guide, kind)` from the matching `dimensionGuides[idx]` per A9 (gate DI-P2-LiveHelperExists). Distance pills format with 3 decimals (gate DI-P2-LiveDistanceTest); angle pills with 2 decimals (gate DI-P2-LiveAngleTest). Typed buffer overrides live with abs display per A1 (gate DI-P2-AbsDisplayTest). Placeholder slice field is no longer read by chrome (gate DI-P2-NoPlaceholderRead).
- [ ] **Phase 3 — B7 lock + inversion.** Combiner signature includes `cursor` + `locked` (gates DI-P3-CombinerSignature + DI-P3-CombinerLockedParam). Tab on typed field locks; on empty just navigates (gates DI-P3-TabLocksOnTyped + DI-P3-TabEmptyNoLock). All-locked auto-submits (gate DI-P3-AutoSubmitAllLocked). Esc two-step: locked → unlock; else abort (gate DI-P3-EscTwoStep). Direction inversion correct for line/polyline `'point'` arm (gate DI-P3-PointInversionQ3) and rectangle `'numberPair'` arm in all 4 quadrants (gates DI-P3-NumberPairCursorWins + DI-P3-RectAllQuadrants). Rectangle commit branches drop `Math.abs` (gate DI-P3-RectAbsRemoved). Circle and xline single-field inversion explicitly NONE per A11 / A12.
- [ ] **Phase 4 — B8 ArrowUp recall + retire placeholder design.** ArrowUp shows recall pill (gates DI-P4-RecallActiveExists + DI-P4-RecallActionExists + DI-P4-PillRecallRender). ArrowDown / Tab cancel (gate DI-P4-RouterArrowDown). Enter / Space accept (gate DI-P4-SmokeRecallPill end-to-end). Rubber-band freezes during recall (gate DI-P4-FreezeRubberBand). Esc precedence: recall > unlock > abort (gate DI-P4-EscPrecedence). Placeholder design fully retired: slice field, style class, attribute, EditorRoot fallback, smoke-e2e scenario (gates DI-P4-PlaceholdersDropped + DI-P4-NoStalePillReads + DI-P4-NoStaleStyleClass + DI-P4-NoStaleSmokeScenario). Operator shortcuts registry version-bumped `2.1.0` → `2.2.0` with ArrowUp / ArrowDown entries + changelog row (gates DI-P4-OperatorShortcutsVersion + DI-P4-OperatorShortcutsArrowUpEntry — Rev-2 H1). DI state proven non-persisted across the full repo persistence surface — domain (serialize.ts + schemas/) + project-store (store / actions / operation-emit / initial-state / index) + cross-package import barrier (4 gates: DI-P4-NoDIFieldsInPersistence-{Domain, ProjectStore, OperationEmit, NoEditorUiCrossImport} — Rev-2 H2 expanded in Rev-3).
- [ ] **All gates green; typecheck + lint clean across all 4 phases.**
- [ ] **Final test count.** Pre-Phase-1 baseline ≈ 470 (per snap-engine-extension done count). Net-new ≈ 32 across Phases 1-4; rewrites ≈ 6 (which delete + add equivalent count). Target final count ≥ 495.

## 13. Risks + mitigations

| Risk | Mitigation |
|------|-----------|
| Renaming `lastSubmittedBuffers` → `dynamicInputRecall` misses a consumer (slice rename drift) | §1.16.12 stale-symbol purge after Phase 1 commit; gate DI-P1-NoLastSubmittedBuffersRef catches at the file level. |
| Round 7 Phase 2 dim-placeholder code lingers in the codebase as dead code after Phase 4 | Gates DI-P4-PlaceholdersDropped + DI-P4-NoStalePillReads + DI-P4-NoStaleStyleClass + DI-P4-NoStaleSmokeScenario each fail if any reference survives. |
| Combiner signature change breaks every test calling `combineDynamicInputBuffers(manifest, buffers, anchor)` | Phase 3 step 1 explicitly updates every existing combiner test call to pass `cursor` as the 4th arg (existing tests can pass `null` or a fixture cursor — the existing 7 cases in `dynamic-input-combine.test.ts` all have non-empty buffers, so `null` cursor preserves their semantics bit-identically). Signature mismatch surfaces at compile time (TypeScript). Gate DI-P3-Typecheck catches at workspace level. |
| Backspace on a locked field with non-empty buffer leaves a transient "locked + empty" state | Documented edge case (Phase 2 step 2 + §4.0.2 'point' arm fall-back). Combiner's empty-buffer branch falls back to cursor; pill displays empty (label only). User can re-type and lock stays on (Tab won't re-lock per A2 since it's already locked). Acceptable transient state — no fix required. If we wanted to prevent it, lock would need to gate Backspace in router; deferred per A10 simplicity ("lock state location: option (a) — slice only, no router-side state machine"). |
| Rectangle's signed numberPair commit produces wrong origin in some quadrant edge case | Phase 3 step 6 adds a 4-quadrant test fixture (gate DI-P3-RectAllQuadrants). The math is min-corner derivation: `origin = { x: min(corner1.x, corner1.x + a), y: min(corner1.y, corner1.y + b) }`. Closed-form; no edge cases other than `a === 0 || b === 0` which the existing zero-reject path handles. |
| Live cursor read gives slightly wrong value at the moment the user starts typing (race between cursor-tick and key event) | Live read happens in pill chrome on every render; React batches state updates. The cursor-tick subscription writes `dimensionGuides`; the keypress writes `buffers`. Both flow through the slice; chrome's `useEditorUi` selector picks both up. The display transition is visible: empty pill shows live `5.123`; user types `5`; pill shows `5` (typed value, abs display). Race: if cursor moves between user pressing `5` and the chrome render, the `5.123` is replaced with `5.456`, then immediately `5` (typed). Visible flicker is ≤ 1 frame; acceptable per existing rAF coalescing pattern. |
| ArrowUp during DI without a prior submit fires no-op silently — user might not realize ArrowUp was meant to recall | Acceptable per A5 (no history scrolling; no UI affordance to indicate recall is available). Future UX work (out of scope) could add a subtle "↑ recall" hint near the focused pill. Risk: low — ArrowUp on canvas focus has no other meaning in the current router (no scroll behavior). |
| Two-step Esc has surprising precedence: a user expecting Esc to abort while recall is active gets recall-cancel instead, then a second Esc to abort | Documented behavior (A3); precedence locked: recall > unlock > abort. This matches AC convention (multi-modal Esc unwinds modes one at a time before aborting). Smoke-e2e covers via gate DI-P4-EscPrecedence. |
| Rubber-band freeze during recall feels broken if the user moves the mouse expecting the preview to follow | Per A16 design intent (rubber-band freezes; cursor moves; recall pill follows cursor). User feedback during scoping (Q5 lock) confirms desired behavior. Smoke-e2e gate DI-P4-FreezeRubberBand asserts the freeze. |
| `lastKnownCursor` is null at first DI submit (degenerate case — submit fires before any mousemove on canvas) | Combiner per §4.0.2 returns null for `'point'` arm if cursor is null AND any required buffer is empty. (When all required buffers are non-empty, cursor is unused and the combiner produces a normal Input even with null cursor.) EditorRoot's existing "ignore submit" path on null Input handles gracefully (buffers stay; user can move mouse + retry). |
| Implicit auto-submit on Tab-all-locked surprises a user who expected Tab to just navigate | Documented behavior (A18). Smoke-e2e covers via gate DI-P3-AutoSubmitAllLocked. The user's mental model (per scoping): "all fields locked = explicit commit." Aligned. |
| The DI submit path is already complex (placeholder fallback + history append + recordSubmittedBuffers + clearDynamicInput). Phase 4 adds another branch (recallActive accept) on top | Phase 4 step 6 places the recallActive branch FIRST (at the top of Enter/Space handler), so it short-circuits before the standard submit path executes. The standard submit path is unchanged when `recallActive === false`. Net complexity: +1 branch; no nesting. |
| ADR-025 immutability constraint prevents documenting the cursor-aware combiner formally | No ADR change needed (per §6 Deviations analysis). The combiner refinement is an implementation detail; ADR-025's contract is upheld (manifest shape unchanged, deg→rad invariant preserved, geometry guides unchanged). |

## Plan Review Handoff

### Files touched by this plan
- `packages/editor-2d/src/ui-state/store.ts` (Phases 1, 4 — slice contract overhaul).
- `packages/editor-2d/src/EditorRoot.tsx` (Phases 1, 3, 4 — submit path threading + cleanup).
- `packages/editor-2d/src/tools/dynamic-input-combine.ts` (Phase 3 — signature + per-arm inversion).
- `packages/editor-2d/src/tools/runner.ts` (Phase 4 — recall freeze).
- `packages/editor-2d/src/keyboard/router.ts` (Phases 3, 4 — Tab lock + auto-submit + ArrowUp / ArrowDown + Esc precedence).
- `packages/editor-2d/src/chrome/DynamicInputPills.tsx` (Phases 2, 4 — live render + recall pill + cleanup).
- `packages/editor-2d/src/chrome/DynamicInputPills.module.css` (Phase 4 — recall-pill style).
- `packages/editor-2d/src/tools/draw/draw-rectangle.ts` (Phase 3 — drop `Math.abs` on numberPair commit).
- Tests: `ui-state.test.ts`, `keyboard-router.test.ts`, `dynamic-input-combine.test.ts`, `DynamicInputPills.test.tsx`, `draw-tools.test.ts`, `tool-runner.test.ts`, `smoke-e2e.test.tsx`.
- Docs: `docs/operator-shortcuts.md` (ArrowUp / ArrowDown additions).

**Not touched:** `packages/editor-2d/src/tools/types.ts` (no manifest type change — A6 lock); `packages/editor-2d/src/tools/draw/draw-line.ts`, `draw-polyline.ts`, `draw-circle.ts`, `draw-xline.ts` (combiner output already lands correctly in their existing addPrimitive paths); ADR-025 (no contract change per §6).

### Paste to Codex for plan review

> Review this plan using the protocol at `docs/procedures/Codex/02-plan-review.md` (Procedure 02). Apply strict evidence mode. Start from Round 1.
>
> Plan-vs-code grounding: §3.1 verified every cited construct against the file at the cited line range (24 rows, all Match). The runner is function-based (per the §1.4.1 lesson from M1.3 Round 6) — `startTool(toolId, factory): RunningTool`, not a class.
>
> Schema-strategy: this plan does NOT change ADR-025; the cursor-aware combiner is a refinement of `combineAs` interpretation, not a manifest contract change. ADR-025 §4 angle-as-degrees invariant carries forward unchanged.
>
> Bundling: B6 + B7 + B8 land together because they share the slice contract, manifest pipeline, and recall map. Splitting means three contract migrations. Phase 1 establishes the contract; Phase 2 = B6; Phase 3 = B7; Phase 4 = B8 + retires the Round 7 Phase 2 placeholder design via GR-1 clean-break.
>
> Done Criteria references §4.0.1 supported per-field semantics matrix as the canonical scope statement (5 tools × per-field semantics × 4 phases).

---

## Post-execution notes (§3.7)

Live record of mid-execution patches per Procedure 03 §3.7. Entries are append-only.

### 2026-05-01 — Phase 1 §3.10 gate-command tightening

During Phase 1 execution, gate `DI-P1-RenamedFieldExists` (originally `rg -n "dynamicInputRecall" packages/editor-2d/src/ui-state/store.ts` → "exactly 2 matches") produced 8 matches in `store.ts`: the 2 declarative sites the gate intended to assert (interface field declaration + initial state), plus 4 JSDoc references and 2 body reads in `setDynamicInputManifest` / `recordSubmittedBuffers` action bodies. The un-anchored regex picks up every textual occurrence; the gate intent is the 2 declarative sites only.

**Patch applied:** regex tightened to `rg -nE "^\s*dynamicInputRecall:" packages/editor-2d/src/ui-state/store.ts` (matches only object-property colons in declarative position). Expected count "exactly 2" preserved. Gate now passes literally.

User acknowledged via "ok" 2026-05-01 before patch was committed. Other 3 Phase 1 grep gates (`NoLastSubmittedBuffersRef`, `LockFieldExists`, `LockMutatorExists`) passed as originally written.

### 2026-05-01 — Phase 2 §3.10 placeholder-test sequencing patch

During Phase 2 execution, discovered that the existing `Round 7 Phase 2 — dim placeholder rendering` describe block (`tests/DynamicInputPills.test.tsx:146-220`) fails as soon as Phase 2 lands its live-cursor render branch:

1. The block asserts `data-pill-placeholder="true"` attribute, which Phase 2 removes.
2. The block asserts pill text contains the persisted buffer values (e.g., `"A: 30"`), but Phase 2 makes empty-buffer pills render live cursor-derived values from the dimension guide (e.g., `"A: 28.65"` for the test's `sweepAngleRad = 0.5`).

The plan §4.1 originally said "Phase 4: drop placeholder-render tests" — but Phase 2's render change makes them fail NOW, so DI-P2-Tests can't pass while they remain.

**Patch applied:** plan §4.1 row updated to move the placeholder-test deletion from Phase 4 to Phase 2 as a same-commit cleanup. Phase 4 keeps only the new recall-pill test additions. Plan-vs-reality sequencing fix; no scope or behavior change.

User acknowledged via "ok" 2026-05-01 before patch was committed.

### 2026-05-01 — Phase 3 §3.10 gate-regex tightenings (2 patches)

During Phase 3 execution, two gates' regex over-matched legitimate code that was supposed to remain:

**Patch A — DI-P3-CombinerNoLockedParam.** Original regex `rg -n "locked"` over-matched the JSDoc references in `dynamic-input-combine.ts` that explicitly state "The `locked` slice field is NOT a parameter here" — those are bucket-(b) intentional negative framing per §1.16.12. Regex tightened to `rg -n "^\s*locked\s*:"` to catch only object-property declarations (which would be the parameter shape). Same precedent as Phase 1 patch.

**Patch B — DI-P3-RectAbsRemoved.** Original regex `Math\.abs\(c1\.a\)|Math\.abs\(c1\.b\)` over-matched the legitimate retained `Math.abs(c1.a)` / `Math.abs(c1.b)` at the `addPrimitive({ width, height })` site — the plan explicitly says width/height stay positive in the primitive (origin derivation gets the signed delta; primitive fields are abs). The actual invariant being asserted is "origin is derived from min-corner of (corner1, corner1+(a,b)), NOT corner1 directly." Regex retargeted to `rg -n "origin:\s*corner1\b"` (catches the OLD pre-Phase-3 pattern where origin was assigned `corner1` directly without min-derivation).

Both patches preserve gate intent + literal expected-zero semantics. User acknowledged via the standing §3.10 ack from 2026-05-01 covering Phase 1 + Phase 2 patches; this Phase 3 round is the same class of plan-vs-reality regex-tightening work and is documented here per §3.7 append-only convention.
