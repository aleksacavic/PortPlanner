// Operation per ADR-020 (supersedes ADR-010). Every mutation is logged
// with a `targetKind` discriminant + `targetId` branded at use site +
// `before` / `after` snapshots typed as a TargetSnapshot discriminated
// union. `promotionGroupId` is optional and set by Phase M1.3b
// promotion ops. The `dimension` arm is type-level unreachable in
// M1.3a (Condition 2 of progressive implementation per §0.7); M1.3c
// widens it.

import type {
  GridId,
  LayerId,
  ObjectId,
  OperationId,
  PrimitiveId,
  ProjectId,
  UserId,
} from '../ids';
import type { GridSnapshot } from './grid';
import type { LayerSnapshot } from './layer';
import type { ObjectSnapshot } from './object';
import type { PrimitiveSnapshot } from './primitive';

export type OperationType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'GENERATE'
  | 'FREEZE'
  | 'DETACH'
  | 'UNFREEZE';

export type TargetKind = 'object' | 'primitive' | 'dimension' | 'layer' | 'grid';

export type TargetSnapshot =
  | { kind: 'object'; snapshot: ObjectSnapshot }
  | { kind: 'primitive'; snapshot: PrimitiveSnapshot }
  | { kind: 'layer'; snapshot: LayerSnapshot }
  | { kind: 'grid'; snapshot: GridSnapshot }
  | { kind: 'dimension'; snapshot: never };

export interface Operation {
  /** UUIDv7 primary key. */
  id: OperationId;
  /** The project this operation applies to. */
  projectId: ProjectId;
  /** Local monotonic counter per client — increments on each emitted op. */
  sequence: number;
  /** ISO-8601 timestamp of emission on the client. */
  timestamp: string;
  /** Emitter identity. M1 uses LOCAL_USER_ID placeholder until auth lands M3+. */
  userId: UserId;
  /** Operation discriminator. */
  type: OperationType;
  /** Target entity kind. */
  targetKind: TargetKind;
  /**
   * Target entity id. Branded at use site as one of
   * `ObjectId | PrimitiveId | LayerId | GridId` (DimensionId M1.3c).
   * Stored as raw string for serialisation.
   */
  targetId: ObjectId | PrimitiveId | LayerId | GridId | string;
  /** Pre-operation snapshot. Null on CREATE. */
  before: TargetSnapshot | null;
  /** Post-operation snapshot. Null on DELETE. */
  after: TargetSnapshot | null;
  /**
   * Promotion atomicity per ADR-016 §Promotion contract.
   * Set when an op is part of a promotion group (DELETE primitive +
   * CREATE object). M1.3a has no promotion; field stays optional /
   * absent. M1.3b populates it.
   */
  promotionGroupId?: string;
}
