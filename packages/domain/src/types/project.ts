// The Project — the authoritative, serializable value representing
// the entire project state. Previously called "project document"
// pre-2026-04-22; see glossary and ADR-010 for architectural context.

import type { ObjectId, ProjectId } from '../ids';
import type { CoordinateSystem } from './coordinate-system';
import type { ProjectObject } from './object';

export interface Project {
  /** UUIDv7 primary key. */
  id: ProjectId;
  /** Schema version for forward-compatibility checks. */
  schemaVersion: '1.0.0';
  /** Human-readable project name, shown in UI. */
  name: string;
  /** ISO-8601 timestamp of project creation. */
  createdAt: string;
  /** ISO-8601 timestamp of last persistence write. */
  updatedAt: string;
  /**
   * Geodetic anchor. `null` means "origin not yet chosen" — consistent
   * with `docs/coordinate-system.md` §"Project origin selection"
   * ("the origin is chosen by the user… immutable once set"). M1.2
   * creates projects with `null`; M1.3 UI enforces non-null before
   * any object is placed.
   */
  coordinateSystem: CoordinateSystem | null;
  /** Objects indexed by their UUIDv7 id. */
  objects: Record<ObjectId, ProjectObject>;
  /** Active scenario id per ADR-006; null when working on the baseline. */
  scenarioId: string | null;
}
