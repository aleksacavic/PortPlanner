// Tool generator types per ADR-023. Each tool is an async generator
// that yields `Prompt` records and consumes `Input` events. The
// ToolRunner drives the generator and routes canvas / keyboard / bar
// inputs in.

import type { Point2D, Primitive, TargetKind } from '@portplanner/domain';

export interface SubOption {
  label: string;
  shortcut: string;
}

export type AcceptedInputKind =
  | 'point'
  | 'number'
  | 'numberPair'
  | 'angle'
  | 'distance'
  | 'entity'
  | 'subOption';

// M1.3 Round 6 — Dynamic Input manifest contract per ADR-024.
// Sparse declarative metadata published once on prompt-yield; carries
// NO anchor info. Anchor coords live on `overlay.dimensionGuides`
// (per-tool cursor-effect responsibility). See plan §3 A2.1.

export type DynamicInputFieldKind = 'number' | 'distance' | 'angle';

export interface DynamicInputField {
  kind: DynamicInputFieldKind;
  label?: string;
}

export type CombineAsPolicy = 'numberPair' | 'point' | 'number' | 'angle';

export interface DynamicInputManifest {
  fields: DynamicInputField[];
  combineAs: CombineAsPolicy;
}

// `DimensionGuide` discriminated union — flat metric coords ONLY.
// No reference strings, no callbacks, no anchor IDs (Rev-2 H1 lock).
// Painter `paintDimensionGuides` reads these flat coords; per-tool
// cursor-effect handler (extended `previewBuilder` style via
// `Prompt.dimensionGuidesBuilder`) writes them per cursor-tick.
//
// Sign conventions (Round-6 Remediation Round-2):
//   - Metric Y is UP (mathematical convention; canvas transform applies
//     the Y-flip — see `applyToCanvasContext` in view-transform.ts).
//   - `linear-dim` perpendicular = CCW rotation of (anchorB - anchorA)
//     in metric space. To put the dim line on a chosen side of a
//     segment, choose the (anchorA, anchorB) order such that the
//     desired side is to the LEFT of (B - A) in metric Y-up — i.e.,
//     CCW perp points toward it.
//   - `angle-arc` is drawn `from baseAngleRad sweeping sweepAngleRad`
//     at radius `radiusMetric`. Sign of sweep determines arc direction:
//     positive = visually CCW (above-baseline if base = 0); negative =
//     visually CW (below-baseline if base = 0). Pivot is the vertex of
//     the angle; baseline extends from pivot at `baseAngleRad` with the
//     SAME length so the arc terminates on the baseline endpoint. For
//     line/polyline this means pivot = LINE START (not cursor) and
//     `radiusMetric` = full segment length, so the arc passes through
//     the cursor (per ADR-025).
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
      /**
       * Arc radius in METRIC units (= polar baseline length).
       *
       * Geometric contract (Round-2 user spec): the arc is centered at
       * `pivot`, PASSES THROUGH the cursor, and TERMINATES on the polar
       * baseline. To satisfy this, tools set `radiusMetric` to the full
       * line length (distance from pivot to cursor); the painter draws
       * the polar baseline at the same length so its endpoint
       * coincides with the arc's endpoint on the baseline.
       *
       * For line / polyline:
       *   pivot = line start (p1)
       *   sweepAngleRad = atan2(cursor - p1)
       *   radiusMetric = hypot(cursor - p1)
       */
      radiusMetric: number;
    };
// `radius-line` variant removed in M1.3 Round 6 Remediation Round-3
// (Codex Round-3 dead-variant gate finding). Original ADR-024 wired
// the circle's radius prompt to a `radius-line` guide; ADR-025 §5
// migrated circle to `linear-dim` along center→cursor. With no
// production consumer, the variant is removed per GR-1 clean-break
// (no compatibility shims, no forward-extensibility placeholders).
// Future operators that need a radius-tick visual add a new variant
// when their concrete need lands.

/**
 * In-flight visualisation a tool yields alongside a Prompt. The tool
 * runner re-invokes `Prompt.previewBuilder` on every cursor change and
 * writes the result to `editorUiStore.overlay.previewShape`. The paint
 * loop's overlay pass dispatches by `kind` — see `paintPreview` (line /
 * polyline / rectangle / circle / arc-2pt / arc-3pt / xline) and
 * `paintSelectionRect` (selection-rect arm).
 *
 * Defined in Phase 1 of M1.3d for type-correctness of the
 * `overlay.previewShape: PreviewShape | null` slice field; consumed
 * by Phase 4 (paintPreview, runner subscription) and Phase 7
 * (select-rect tool, paintSelectionRect dispatcher). Forward-compat
 * note: M1.3b modify operators may add a `'modified-entities'` arm;
 * extension is purely additive.
 */
export type PreviewShape =
  | { kind: 'line'; p1: Point2D; cursor: Point2D }
  | { kind: 'polyline'; vertices: Point2D[]; cursor: Point2D; closed: boolean }
  | { kind: 'rectangle'; corner1: Point2D; cursor: Point2D }
  | { kind: 'circle'; center: Point2D; cursor: Point2D }
  | { kind: 'arc-2pt'; p1: Point2D; cursor: Point2D }
  | { kind: 'arc-3pt'; p1: Point2D; p2: Point2D; cursor: Point2D }
  | { kind: 'xline'; pivot: Point2D; cursor: Point2D }
  | {
      kind: 'selection-rect';
      start: Point2D;
      end: Point2D;
      direction: 'window' | 'crossing';
    }
  // M1.3d-Remediation-3 F4 — translucent ghost of entities being moved /
  // copied. The arm carries the source primitives + a metric translation.
  // The painter (drawModifiedEntitiesPreview) strokes each primitive's
  // outline at the offset using the same canvas.transient.preview_stroke
  // styling as the other arms. Move + Copy yield this arm.
  | { kind: 'modified-entities'; primitives: Primitive[]; offsetMetric: Point2D }
  // M1.3b simple-transforms Phase 1 — 4 new arms for the modify-operator
  // cluster (Rotate / Scale / Mirror / Offset). Each carries the metadata
  // the painter needs to compute the per-primitive transformed outline
  // (calling the matching domain helper from `@portplanner/domain`). Per
  // I-MOD-2: paintPreview switch is exhaustive (TS catches missing case).
  | { kind: 'rotated-entities'; primitives: Primitive[]; base: Point2D; angleRad: number }
  | { kind: 'scaled-entities'; primitives: Primitive[]; base: Point2D; factor: number }
  | { kind: 'mirrored-entities'; primitives: Primitive[]; line: { p1: Point2D; p2: Point2D } }
  | { kind: 'offset-preview'; primitive: Primitive; distance: number; side: 1 | -1 };

export interface Prompt {
  text: string;
  subOptions?: SubOption[];
  defaultValue?: string;
  acceptedInputKinds: AcceptedInputKind[];
  /**
   * M1.3d Phase 4 — optional cursor-driven preview builder. When set,
   * the tool runner subscribes to `editorUiStore.overlay.cursor` and
   * re-invokes this on every cursor change, writing the result to
   * `overlay.previewShape`. The paint loop's overlay pass dispatches
   * the shape to `paintPreview` (or `paintSelectionRect` for the
   * `'selection-rect'` arm). Tools that don't need a preview omit
   * this field.
   *
   * Contract: `previewBuilder` MUST be a pure function of the cursor
   * — captured tool-local state (start point, accumulated vertices)
   * is bound by closure at yield time. The runner does NOT cache or
   * dedupe previewBuilder outputs; it writes whatever the function
   * returns.
   */
  previewBuilder?: (cursor: Point2D) => PreviewShape;
  /**
   * M1.3d-Remediation-3 F1 — direct distance entry anchor. When set,
   * a numeric input typed into the command bar is interpreted as a
   * distance along the cursor direction from this anchor:
   *   `dest = anchor + unit(cursor - anchor) * distance`
   * EditorRoot.handleCommandSubmit reads this (via the runner-published
   * `commandBar.directDistanceFrom` slice field) plus the latest
   * non-null cursor (`overlay.lastKnownCursor`) and feeds a 'point'
   * input instead of a 'number' input. Tools opt in by yielding the
   * anchor (line p1, polyline last vertex, circle center, arc p1/p2,
   * etc.). Omit when the prompt's numeric semantic is NOT a distance
   * along cursor heading (e.g. typed Width/Height for rectangle's
   * Dimensions sub-option).
   */
  directDistanceFrom?: Point2D;
  /**
   * M1.3 Round 6 — optional Dynamic Input manifest. When set, the
   * runner publishes the manifest to `commandBar.dynamicInput.manifest`
   * (sparse) on yield. Multi-pill chrome reads the manifest for field
   * count / labels / activeFieldIdx; keyboard router routes Tab /
   * numeric / Enter to the per-field buffers. Tools without DI omit
   * this field — legacy single-pill / F1 path unchanged.
   *
   * Plan §3 A2.1: manifest carries NO anchor info; anchor coords live
   * on `overlay.dimensionGuides` (sibling `dimensionGuidesBuilder`).
   */
  dynamicInput?: DynamicInputManifest;
  /**
   * M1.3 Round 6 — optional dimension-guides builder mirroring the
   * existing `previewBuilder` pattern. Pure function `(cursor) =>
   * DimensionGuide[]`. Runner subscribes to `overlay.cursor` and
   * re-invokes on every cursor change; result is written to
   * `overlay.dimensionGuides`. Synchronous seed on yield happens in
   * the same block at runner.ts:116-130 that already seeds
   * `previewBuilder` (Rev-3 H2 first-frame coherence + Rev-4 H +
   * Rev-6 single-method re-entrancy guard).
   *
   * Contract: pure function — does NOT receive a `RunningTool`
   * reference, cannot reach `feedInput` (architectural primary
   * defense for re-entrancy per plan §3 A2.1).
   */
  dimensionGuidesBuilder?: (cursor: Point2D) => DimensionGuide[];
  /**
   * M1.3 Round 7 Phase 2 — buffer-persistence identity suffix. When
   * set, the runner computes this prompt's persistence key as
   * `${toolId}:${persistKey}`; otherwise the key is
   * `${toolId}:${promptIndex}` (canonical expression per plan A16).
   * Tools that share buffer state across prompt boundaries opt in via
   * an explicit string — e.g., `draw-polyline` sets `'next-vertex'`
   * so every loop iteration of the next-vertex prompt writes to the
   * same key. Most tools omit this field; the prompt-index fallback
   * gives each yield its own bucket automatically.
   */
  persistKey?: string;
}

export type Input =
  | { kind: 'point'; point: Point2D }
  | { kind: 'number'; value: number }
  // M1.3d-Remediation-5 H1 — comma-pair numeric input. Sub-prompts that
  // semantically take TWO numbers in one shot (e.g. rectangle's
  // Dimensions sub-flow `<width,height>`) opt in by setting
  // `acceptedInputKinds: ['numberPair']`. EditorRoot.handleCommandSubmit
  // parses raw `"a,b"` (with trim-both-tokens guard) and feeds this
  // Input arm. AC parity for muscle-memory typing.
  | { kind: 'numberPair'; a: number; b: number }
  | { kind: 'angle'; radians: number }
  | { kind: 'distance'; metres: number }
  | { kind: 'entity'; entityId: string; entityKind: TargetKind }
  | { kind: 'subOption'; optionLabel: string }
  // 'commit' is a tool-level "I'm done with my open-ended input loop;
  // commit what you have". Distinct from 'escape' (which aborts and
  // discards). Sources: empty Enter in the command bar, Enter on canvas
  // focus, right-click on canvas. Tools with a fixed-arity prompt chain
  // (line, rectangle, circle, arc) treat unexpected `commit` as
  // aborted; tools with an open-ended loop (polyline) use it to end
  // the loop and commit the in-flight result if it's valid.
  | { kind: 'commit' }
  | { kind: 'escape' };

export type ToolGenerator = AsyncGenerator<Prompt, ToolResult, Input>;

export type ToolResult =
  | { committed: true; description?: string }
  | { committed: false; reason: 'aborted' };
