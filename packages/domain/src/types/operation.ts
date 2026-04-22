// Operation per ADR-010 Project Sync and Offline Model.
// Every mutation is an operation logged with the full shape below.
// M1.2 DEFINES the type but does NOT emit operations (no mutations
// exist yet; emission starts in M1.3 when canvas interactions land).
// Classified as progressive implementation per §6 PI-1 of the M1.2 plan.

import type { ObjectId, OperationId, ProjectId, UserId } from '../ids';
import type { ObjectSnapshot } from './object';

export type OperationType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'GENERATE'
  | 'FREEZE'
  | 'DETACH'
  | 'UNFREEZE';

export interface Operation {
  /** UUIDv7 primary key. */
  id: OperationId;
  /** The project this operation applies to. */
  projectId: ProjectId;
  /** Local monotonic counter per client — increments on each emitted op. */
  sequence: number;
  /** ISO-8601 timestamp of emission on the client. */
  timestamp: string;
  /** Emitter identity. M1.2 uses LOCAL_USER_ID placeholder until auth lands M3+. */
  userId: UserId;
  /** Operation discriminator. */
  type: OperationType;
  /** Target object id. All ADR-010 op types operate on a specific object. */
  objectId: ObjectId;
  /** Pre-operation snapshot. Null on CREATE. */
  before: ObjectSnapshot | null;
  /** Post-operation snapshot. Null on DELETE. */
  after: ObjectSnapshot | null;
}
