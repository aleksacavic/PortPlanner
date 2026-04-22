// Base object contract per ADR-002.
// Analysis bindings, cost bindings, and mesh descriptors are NOT on
// the object — they live on separate records. `parameters` is the
// extensible JSONB bag for object-type-specific fields; concrete
// per-type parameter schemas land in M1.4 with RTG_BLOCK and in
// subsequent milestones for ROAD / BUILDING / PAVEMENT / BERTH.

import type { ObjectId } from '../ids';
import type { OwnershipState } from './ownership';

export interface ProjectObject {
  /** UUIDv7 primary key. */
  id: ObjectId;
  /** Object type discriminator (e.g. 'RTG_BLOCK'). Typed-by-union in M1.4. */
  type: string;
  /** Optional sub-category within the object type. */
  classification?: string;
  /** GeoJSON geometry in project-local metric coordinates per ADR-001. */
  geometry: unknown;
  /** Extensible parameter bag — JSONB per ADR-002. */
  parameters: Record<string, unknown>;
  /** Ownership state per ADR-003. */
  ownership: OwnershipState;
  /** Library traceability fields per ADR-005 — snapshot reference, not live link. */
  libraryRef?: {
    source: string;
    version: string;
  };
}

/**
 * Structural alias used by ADR-010's Operation record for before/after
 * snapshots. In M1.2 this is the same shape as ProjectObject; future
 * refinements (stripping ephemeral fields, etc.) can diverge the types
 * without changing every Operation consumer.
 */
export type ObjectSnapshot = ProjectObject;
