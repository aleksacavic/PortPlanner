// The Project — the authoritative, serializable value representing
// the entire project state. Previously called "project document"
// pre-2026-04-22; see glossary and ADR-020 for architectural context.

import type { GridId, LayerId, ObjectId, PrimitiveId, ProjectId } from '../ids';
import type { CoordinateSystem } from './coordinate-system';
import type { Grid } from './grid';
import type { Layer } from './layer';
import type { ProjectObject } from './object';
import type { Primitive } from './primitive';

export interface Project {
  /** UUIDv7 primary key. */
  id: ProjectId;
  /** Schema version. Bumped 1.0.0 → 1.1.0 in M1.3a, 1.1.0 → 1.2.0 in
   *  M1.3 snap-engine-extension Phase 3 (clean-break per GR-1; legacy
   *  saves return LoadFailure on parse, no migration shim). */
  schemaVersion: '1.2.0';
  /** Human-readable project name, shown in UI. */
  name: string;
  /** ISO-8601 timestamp of project creation. */
  createdAt: string;
  /** ISO-8601 timestamp of last persistence write. */
  updatedAt: string;
  /**
   * Geodetic anchor. Optional — drafting operates entirely in
   * project-local metric (WCS) and does not require this. The anchor
   * is consulted only by future georef-requiring features (basemap,
   * GIS import / export, none in M1.3a).
   */
  coordinateSystem: CoordinateSystem | null;
  /** Typed objects indexed by their UUIDv7 id. */
  objects: Record<ObjectId, ProjectObject>;
  /** Drawing primitives per ADR-016 indexed by their UUIDv7 id. */
  primitives: Record<PrimitiveId, Primitive>;
  /** Layers per ADR-017 indexed by their UUIDv7 id. Default seeded on create. */
  layers: Record<LayerId, Layer>;
  /** Grids per ADR-016 indexed by their UUIDv7 id. */
  grids: Record<GridId, Grid>;
  /** Active scenario id per ADR-006; null when working on the baseline. */
  scenarioId: string | null;
}
