// Tool generator types per ADR-023. Each tool is an async generator
// that yields `Prompt` records and consumes `Input` events. The
// ToolRunner drives the generator and routes canvas / keyboard / bar
// inputs in.

import type { Point2D, TargetKind } from '@portplanner/domain';

export interface SubOption {
  label: string;
  shortcut: string;
}

export type AcceptedInputKind = 'point' | 'number' | 'angle' | 'distance' | 'entity' | 'subOption';

export interface Prompt {
  text: string;
  subOptions?: SubOption[];
  defaultValue?: string;
  acceptedInputKinds: AcceptedInputKind[];
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
