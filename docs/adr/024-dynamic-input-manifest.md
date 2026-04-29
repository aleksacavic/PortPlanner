# ADR-024 — Dynamic Input Manifest

**Status:** SUPERSEDED — see [ADR-025](025-dynamic-input-manifest-v2.md)
(2026-04-29). The ground architecture (per-prompt manifest on the
`Prompt` shape, sparse manifest publication, painter contract, sync-
bootstrap re-entrancy, click-eat guard, angle-as-degrees invariant for
`combineAs: 'point'`) carries forward. ADR-025 records ONLY the
geometric / schema refinements surfaced during post-commit remediation
Round 2 (`DimensionGuide.angle-arc` `radiusCssPx` + `polarRefLengthMetric`
collapsed into a single `radiusMetric`; `linear-dim.mirrorWitness` dead
field removed; `CombineAsPolicy` gains an `'angle'` arm; xline migration
added; circle guide kind shifts from `radius-line` no-op to `linear-dim`;
`DIM_OFFSET_CSS` SSOT bumped 20 → 40).
**Date:** 2026-04-29
**Cross-references:** ADR-023 (`docs/adr/023-tool-state-machine-and-command-bar.md`) — extends the tool runner / command bar / keyboard routing contracts described in ADR-023 §Tool generator shape and §Keyboard routing rules. ADR-023 itself is **NOT** modified per `00-architecture-contract.md §0.6` ("ADR files: never edited after acceptance"); this ADR records the additive Dynamic Input contract.

## Context

ADR-023 established a single-pill Dynamic Input chrome at the cursor (M1.3d-Remediation-4 G2): the `commandBar.inputBuffer` accumulates digits / punctuation typed at canvas focus; the pill renders the buffer; Enter submits via `onSubmitBuffer` / `handleCommandSubmit`. This was sufficient for single-value entry (a typed distance interpreted as polar via F1 `directDistanceFrom`) but did not match AutoCAD's multi-field Dynamic Input UX: AC anchors **multiple** input pills at meaningful geometric positions (W on bottom edge, H on right edge, distance on the line itself, angle near an arc near the start point), each with its own caret + Tab cycling between them, with witness/dim lines + angle arcs giving the measured-dimension feel.

Manual user testing of M1.3d-Rem-4's single-pill DI (2026-04-28) surfaced the AC-parity gaps. M1.3 Round 6 (`docs/plans/feature/m1-3-di-pill-redesign.md`) reaches Codex Go after 8 review rounds and ships the AC-style design.

## Decision

Introduce a per-prompt **Dynamic Input manifest** contract on the existing `Prompt` shape (ADR-023 §Tool generator shape) that opts a prompt into the multi-field DI flow without changing existing single-pill behaviour for prompts that omit the manifest.

### 1. Manifest shape (sparse declarative metadata)

```ts
export type DynamicInputFieldKind = 'number' | 'distance' | 'angle';

export interface DynamicInputField {
  kind: DynamicInputFieldKind;
  label?: string;
}

export type CombineAsPolicy = 'numberPair' | 'point' | 'number';

export interface DynamicInputManifest {
  fields: DynamicInputField[];
  combineAs: CombineAsPolicy;
}
```

The manifest is **sparse**: it declares only the field count, kinds, labels, and how to combine the per-field buffers into a single `Input` on submit. It carries **NO anchor coordinates**. Anchor coords live on the sibling `overlay.dimensionGuides` slice (see §3 below).

Tools opt into DI by setting `Prompt.dynamicInput?: DynamicInputManifest` on the relevant prompt. Tools without DI omit the field — legacy single-pill / F1 path stays unchanged. This is an additive extension to the `Prompt` interface, GR-1 clean-break compliant (no compatibility shims).

### 2. Dimension-guide schema (flat metric coords only)

`DimensionGuide` is a discriminated union with **three variants**, each carrying flat `{x: number, y: number}` metric coordinates ONLY. NO reference strings, NO callbacks at the shape level, NO anchor-id fields. This is locked at plan-time per Procedure 01 §1.4 (no implementation-guessing on architectural-contract decisions); see plan §3 A2 for the rationale.

```ts
export type DimensionGuide =
  | {
      kind: 'linear-dim';
      anchorA: Point2D;
      anchorB: Point2D;
      offsetCssPx: number;
    }
  | {
      kind: 'angle-arc';
      pivot: Point2D;
      baseAngleRad: number;
      sweepAngleRad: number;
      radiusCssPx: number;
    }
  | {
      kind: 'radius-line';
      pivot: Point2D;
      endpoint: Point2D;
    };
```

The **rationale for flat coords + no reference strings** (vs an alternative reference-descriptor schema like `{kind: 'linear-dim', anchorA: 'p1', anchorB: 'cursor'}`):

1. **Existing pattern in `editor-2d`.** Every tool already updates `overlay.preview` per cursor-tick from its `previewBuilder` callback (a pure `(cursor) => PreviewShape`). Adding `overlay.dimensionGuides` written by a sibling `dimensionGuidesBuilder` is symmetric — zero new infrastructure.
2. **Painter contract.** `DTP-T1`/`T2`/`T6` forbid project-store imports and heavy state lookups in painters. A reference-descriptor schema would push resolution logic into the painter (parse `'midpoint:p1,cursor'`, look up p1 + cursor, compute), violating the contract. Flat coords keep the painter dumb: input is `{x, y}`, output is `ctx.lineTo` calls.
3. **Type-system simplicity.** A discriminated union of plain data; no parallel parser/resolver; no places drift can hide.

Future deviation (e.g. a future M1.3b operator that legitimately needs reference-style anchors) requires a new ADR or extension of this one per `00-architecture-contract.md §0.7`.

### 3. Publication contract

The manifest and the dimension guides live on **two slices** with **two timing patterns**:

- `commandBar.dynamicInput: { manifest: DynamicInputManifest, buffers: string[], activeFieldIdx: number } | null` — **sparse**. Published once per prompt-yield by `tools/runner.ts` when the yielded `Prompt.dynamicInput` is set. `buffers` is initialized to `Array(manifest.fields.length).fill('')` and `activeFieldIdx` to `0`. Each prompt yield with a manifest is one input session — polyline-loop iterations therefore start with empty buffers per leg (reset semantics).
- `overlay.dimensionGuides: DimensionGuide[] | null` — **dynamic**. Written by the per-Prompt `dimensionGuidesBuilder?: (cursor: Point2D) => DimensionGuide[]` callback (mirroring `previewBuilder`'s pattern), invoked by `tools/runner.ts`'s `ensurePreviewSubscription` on every cursor change AND seeded synchronously on prompt-yield (see §4 first-frame coherence below).

The painter `paintDimensionGuides` reads flat coords from `overlay.dimensionGuides` only — no resolution logic, no project-store imports, no manifest reads. Multi-pill chrome `DynamicInputPills` reads BOTH slices: `commandBar.dynamicInput` for buffers + activeFieldIdx + field labels; `overlay.dimensionGuides[N]` for pill N's anchor coords (multi-source reads are allowed in chrome; the painter contract restriction does not apply to React components).

### 4. First-frame coherence + sync-bootstrap re-entrancy contract

**Invariant:** `commandBar.dynamicInput.manifest !== null ⟹ overlay.dimensionGuides !== null && overlay.dimensionGuides.length === manifest.fields.length` (after prompt-yield, before next paint).

`tools/runner.ts` extends its existing `previewBuilder` synchronous-seed block to also seed `dimensionGuidesBuilder` from current `overlay.cursor`, populating `overlay.dimensionGuides` BEFORE returning from the yield-side path. This eliminates the gap between manifest-set and guides-set; pills render coherently on the first paint without flicker.

**Re-entrancy contract:** the synchronous builder seed calls are wrapped in a `try/finally` with a closure-local `inSyncBootstrap = true; ... finally { inSyncBootstrap = false }`. The single external state-advance entrypoint on the returned `RunningTool` interface is `feedInput(input: Input): void`; it checks the flag at entry and throws `'cursor-effect re-entered runner during sync bootstrap'` if set. The architectural primary defense is the pure-function signature of the builders (`(cursor) => Shape` — no `RunningTool` reference, cannot reach `feedInput` in production code); the flag is defense-in-depth for test-time contrivances and future refactors.

The runner is function-based (`startTool(toolId, factory): RunningTool`, not a class with multiple state-advance methods), so the guard is a single-method form — there is no `STATE_MACHINE_ADVANCE_METHODS` SSOT array to iterate. Future state-advance entrypoints added to the `RunningTool` interface MUST extend the flag-check (see plan §3 A2.1 for the explicit allowed/forbidden lists; see Procedure 01 §1.4.1 plan-vs-code grounding rule for the lesson behind this clarification).

### 5. Combine policy registry + angle-unit invariant

The `combineAs` policy is applied at submit time by a single SSOT helper `combineDynamicInputBuffers(manifest, buffers, anchor): Input | null` at `packages/editor-2d/src/tools/dynamic-input-combine.ts`:

- `'numberPair'` → returns `{kind: 'numberPair', a: parsed[0], b: parsed[1]}`. Used by rectangle's W,H. Re-uses M1.3d-Rem-5 H1's `numberPair` Input arm.
- `'point'` → polar conversion. **Angle-unit invariant: the typed `angle` field is INVARIANT in DEGREES (AC convention; user types "30" expecting 30°). The helper performs deg→rad conversion via `(angleDeg * Math.PI) / 180` BEFORE applying `cos`/`sin`.** Used by line/polyline second-point with both fields filled.
- `'number'` → returns `{kind: 'number', value: parsed[0]}`. Used by circle radius and any single-field manifest.

The deg→rad conversion lives **only** in this helper — Gate REM6-P1-AngleUnit verifies `EditorRoot.tsx` has zero conversion-symbol matches (delegation only). Future trig users (e.g. M1.3b Rotate sweep angle) MUST route through the same helper or reuse the same constant — no mixed conventions allowed in the codebase.

The helper returns `null` if any required buffer is empty / un-parseable; the caller (`EditorRoot.onSubmitDynamicInput`) treats null as "ignore submit" (no Input fed; buffers preserved for the user to edit).

### 6. Per-field buffer model + Tab-cycling focus

The keyboard router (`packages/editor-2d/src/keyboard/router.ts`) routes keys per the active state:

- `Tab` / `Shift+Tab` at canvas / bar focus when `commandBar.dynamicInput.manifest !== null` AND `manifest.fields.length > 1` → `preventDefault()` + cycle `activeFieldIdx` (forward / backward modulo field count). Pass-through to native browser behaviour when no DI is active OR single-field manifest (preserves keyboard accessibility for chrome regions).
- Numeric / `.` / `,` / `-` / Backspace at canvas focus when DI is active → route to `dynamicInput.buffers[activeFieldIdx]`. When no DI is active, route to the legacy `inputBuffer`.
- `Enter` / `Space` at canvas focus + tool active when DI is active → invoke `onSubmitDynamicInput(manifest, buffers)` callback (precedence over `onSubmitBuffer`). EditorRoot's implementation delegates to `combineDynamicInputBuffers` and feeds the resulting Input to the runner.
- `Esc` clears DI buffers via `clearDynamicInput()` (in addition to existing accumulator + inputBuffer clear).

### 7. Click-eat extension

The M1.3d-Remediation-4 G2 click-eat guard (`EditorRoot.handleCanvasClick` / `handleGripDown` / `handleSelectRectStart`) extends from `inputBuffer.length > 0` to `hasNonEmptyTypingBuffer()`, which OR-checks `inputBuffer.length > 0` AND `dynamicInput?.buffers.some(b => b.length > 0)`. With DI active, `inputBuffer` may stay empty while `dynamicInput.buffers` are populated — the extension catches this case and suppresses geometry commits while the user is mid-typing.

### 8. ADR-023 cross-reference (one-way)

This ADR cross-references ADR-023 from its own body only. ADR-023 file is **NOT** modified per `00-architecture-contract.md §0.6`. The Dynamic Input contract is a substantive contract addition deserving of its own ADR (per-field buffer model, Tab focus invariant, painter dispatch model, deg→rad conversion invariant, sync-bootstrap re-entrancy contract).

## Implications

- All four primitive draw tools (line, polyline, rectangle, circle) opt into DI on their relevant prompts in M1.3 Round 6. F3 [Dimensions] sub-flow on rectangle stays as a non-DI numberPair prompt (legacy single-pill / bar-form path).
- F1 `directDistanceFrom` (typing a single number into the bottom command line for line / polyline / circle / arc to interpret as polar distance from anchor) STAYS unchanged. It's the single-field bar-form path; DI is the multi-field canvas-focus path. Both surfaces feed the same Input arms; the runner sees a `point` / `numberPair` / `number` Input either way.
- M1.3b modify operators (Rotate / Mirror / Scale / Trim / Extend / Break / Fillet / Chamfer / Offset / Array / Join / Explode / STRETCH / Match Properties) opt into DI manifests as M1.3b ships them. Future trig-using operators (Rotate sweep angle, etc.) MUST route through `combineDynamicInputBuffers` for the deg→rad conversion to preserve the angle-unit invariant.
- The dimension-guides painter (`paintDimensionGuides`) is dispatched in the overlay pass after `paintPreview` so dim guides render on top of the rubber-band geometry, not under.

## Test gates

- Gate REM6-P1-Types / REM6-P1-DimensionGuideTypes — type definitions correct + flat-coord-only schema + sparse field shape.
- Gate REM6-P1-Slice / REM6-P1-OverlayGuides — slice fields + actions wired.
- Gate REM6-P1-Combiner / REM6-P1-AngleUnit — SSOT helper exists + deg→rad in helper only, zero conversion-symbol matches in EditorRoot.tsx.
- Gate REM6-P1-Painter — paintDimensionGuides dispatches by shape kind + mounted in paint.ts overlay pass.
- Gate REM6-P1-Pills — DynamicInputPills mounted; old DynamicInputPill deleted.
- Gate REM6-P1-Router-Tab / REM6-P1-Router-Submit — Tab handler + onSubmitDynamicInput callback wired.
- Gate REM6-P1-FirstFrameCoherence — synchronous-bootstrap-on-prompt-yield unit test in tests/tool-runner.test.ts + first-frame DI coherence smoke scenario.
- Gate REM6-P1-SyncBootstrapNoReentry — feedInput throws when called from inside sync bootstrap; closure-local inSyncBootstrap flag count ≥4 in runner.ts.
- Gate REM6-P1-ClickEat — 3 unit tests in tests/click-eat-with-di.test.tsx (one per actual handler: handleCanvasClick / handleGripDown / handleSelectRectStart) + smoke scenario + annotation-count grep ≥3.
- Gate REM6-P2-Rectangle / Line / Polyline / Circle — per-tool manifest publish on relevant prompt (matches expected fields + combineAs + dimensionGuide kinds).
- Gate REM6-P2-Smoke — 5 mounted-EditorRoot smoke scenarios (rectangle / line / circle DI + click-eat-with-DI + first-frame coherence) ≥10 grep matches in tests/smoke-e2e.test.tsx.
- Gates REM6-9 / REM6-11 / REM6-12 — named test files pass + cross-cutting DTP-T1/T2/T6/T7 + typecheck/check/build clean.

## Plan reference

Implementation plan: `docs/plans/feature/m1-3-di-pill-redesign.md` (Rev-7 at commit `f5e63dc`, Codex Go at Round 8 at 9.9/10). Full revision narrative + post-execution notes capture the 8-round review history and the procedure-tightening lessons (Procedure 01 §1.4.1 plan-vs-code grounding, Procedure 02 §2.4 grounding verification, Procedure 03 §3.0.1 pre-Phase-1 re-grounding, Procedure 01 §1.16.12.a stale-symbol-purge).

## Changelog

| Date | Change |
|---|---|
| 2026-04-29 | Initial. Per-prompt Dynamic Input manifest contract for M1.3 Round 6. |
