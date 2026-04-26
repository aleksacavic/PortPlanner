// Layer entity + DisplayOverrides bag per ADR-017. Every primitive,
// dimension, grid, and typed object carries a required `layerId` and
// a `displayOverrides` bag. Effective style resolution is
// `displayOverrides.<key> ?? layer.<key>` (ByLayer).

import { LayerId } from '../ids';

/**
 * Hex `#RRGGBB` or a semantic-token name. Runtime validation happens
 * in the Zod schema (Phase 2). Type stays open here.
 */
export type ColorValue = string;

/** Open-extensible line type identifier. New kinds added as needed. */
export type LineTypeId = 'continuous' | 'dashed' | 'dotted' | 'dashdot';

/**
 * Per-entity style override bag. Missing key = inherit from layer
 * (ByLayer); present key = explicit override.
 */
export interface DisplayOverrides {
  color?: ColorValue;
  lineType?: LineTypeId;
  lineWeight?: number;
}

export interface Layer {
  id: LayerId;
  /** Display name; unique per project (case-insensitive). */
  name: string;
  color: ColorValue;
  lineType: LineTypeId;
  /** Millimetres at 1:1 plot scale. */
  lineWeight: number;
  visible: boolean;
  /** Frozen layers are hidden + excluded from M3+ generator regen. */
  frozen: boolean;
  /** Locked layers render but are not selectable for modify tools. */
  locked: boolean;
}

export type LayerSnapshot = Layer;

/**
 * Default layer factory. Returns a fresh `Layer` with `id` =
 * `LayerId.DEFAULT` and the protected baseline properties from
 * ADR-017. Seeded by `createNewProject` (project-store, Phase 5).
 */
export function defaultLayer(): Layer {
  return {
    id: LayerId.DEFAULT,
    name: '0',
    color: '#FFFFFF',
    lineType: 'continuous',
    lineWeight: 0.25,
    visible: true,
    frozen: false,
    locked: false,
  };
}
