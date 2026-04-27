// Tool generator types per ADR-023. Each tool is an async generator
// that yields `Prompt` records and consumes `Input` events. The
// ToolRunner drives the generator and routes canvas / keyboard / bar
// inputs in.

import type { Point2D, Primitive, TargetKind } from '@portplanner/domain';

export interface SubOption {
  label: string;
  shortcut: string;
}

export type AcceptedInputKind = 'point' | 'number' | 'angle' | 'distance' | 'entity' | 'subOption';

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
  // copied (and, when M1.3b ships, rotated / scaled / mirrored). The
  // arm carries the source primitives + a metric translation. The
  // painter (drawModifiedEntitiesPreview) strokes each primitive's
  // outline at the offset using the same canvas.transient.preview_stroke
  // styling as the other arms. M1.3b extends per-operator usage; for
  // M1.3d-Rem-3 only move + copy yield this arm.
  | { kind: 'modified-entities'; primitives: Primitive[]; offsetMetric: Point2D };

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
}

export type Input =
  | { kind: 'point'; point: Point2D }
  | { kind: 'number'; value: number }
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
