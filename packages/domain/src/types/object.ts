// Base object contract per ADR-019 (supersedes ADR-002).
// Adds layerId + displayOverrides (ADR-017 ByLayer participation),
// sourceKind + sourceProvenance? (ADR-016 promotion audit). Analysis
// bindings, cost bindings, and mesh descriptors remain off-object
// per ADR-019 §Separate records. `parameters` is the extensible JSONB
// bag; per-type schemas land in M1.3b+ with first typed-object
// constructors.
//
// M1.3a brings the type into ADR-019 compliance proactively — no
// ProjectObject instances exist yet (no typed objects until M1.3b).

import type { LayerId, ObjectId, PrimitiveId } from '../ids';
import type { DisplayOverrides } from './layer';
import type { OwnershipState } from './ownership';
import type { PrimitiveKind } from './primitive';

export interface ProjectObject {
  /** UUIDv7 primary key. */
  id: ObjectId;
  /** Object type discriminator (e.g. 'RTG_BLOCK'). Typed-by-union in M1.4. */
  type: string;
  /** Optional sub-category within the object type. */
  classification?: string;
  /** GeoJSON geometry in project-local metric coordinates per ADR-001. */
  geometry: unknown;
  /** Extensible parameter bag — JSONB per ADR-019. */
  parameters: Record<string, unknown>;
  /** Ownership state per ADR-003. */
  ownership: OwnershipState;
  /** Layer membership per ADR-017. Required, defaults to LayerId.DEFAULT. */
  layerId: LayerId;
  /** Per-entity style override bag per ADR-017. Missing key = ByLayer. */
  displayOverrides: DisplayOverrides;
  /** Source provenance per ADR-016. 'direct' = placed by tool; 'promoted' = born from a primitive. */
  sourceKind: 'direct' | 'promoted';
  /** Promotion audit trail. Set iff `sourceKind === 'promoted'`. */
  sourceProvenance?: {
    primitiveKind: PrimitiveKind;
    /** ISO-8601 timestamp of promotion. */
    promotedAt: string;
    /** Historical reference; the primitive itself is gone after promotion. */
    primitiveId: PrimitiveId;
  };
  /** Library traceability fields per ADR-005 — snapshot reference, not live link. */
  libraryRef?: {
    source: string;
    version: string;
  };
}

/** Structural alias used by ADR-020 Operation `before` / `after`. */
export type ObjectSnapshot = ProjectObject;
