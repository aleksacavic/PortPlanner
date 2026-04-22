// @portplanner/domain — pure logic: types, ids, schemas, canonical serializer.
// M1.2 Phase 1 fills in the foundational types. Extractors, validators,
// generators, and per-object-type refinements land in later milestones.

export type {
  CoordinateSystem,
  ObjectSnapshot,
  Operation,
  OperationType,
  Project,
  ProjectObject,
} from './types';
export { OwnershipState } from './types';

export {
  LOCAL_USER_ID,
  type ObjectId,
  type OperationId,
  type ProjectId,
  type UserId,
  isUUIDv7,
  newObjectId,
  newOperationId,
  newProjectId,
} from './ids';

export {
  CoordinateSystemSchema,
  OperationSchema,
  OwnershipStateSchema,
  ProjectObjectSchema,
  ProjectSchema,
} from './schemas';

export { LoadFailure, deserialize, serialize } from './serialize';
