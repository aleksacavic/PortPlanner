// @portplanner/domain — pure logic: types, ids, schemas, canonical serializer.
// M1.2 Phase 1 fills in the foundational types. Extractors, validators,
// generators, and per-object-type refinements land in later milestones.

export type {
  ArcPrimitive,
  CirclePrimitive,
  ColorValue,
  CoordinateSystem,
  DisplayOverrides,
  Grid,
  GridSnapshot,
  Layer,
  LayerSnapshot,
  LinePrimitive,
  LineTypeId,
  ObjectSnapshot,
  Operation,
  OperationType,
  TargetKind,
  TargetSnapshot,
  Point2D,
  PointDisplayShape,
  PointPrimitive,
  PolylinePrimitive,
  Primitive,
  PrimitiveBase,
  PrimitiveKind,
  PrimitiveSnapshot,
  Project,
  ProjectObject,
  RectanglePrimitive,
  XlinePrimitive,
} from './types';
export { defaultLayer, OwnershipState } from './types';

export {
  LOCAL_USER_ID,
  type GridId,
  type ObjectId,
  type OperationId,
  type PrimitiveId,
  type ProjectId,
  type UserId,
  LayerId,
  isUUIDv7,
  newGridId,
  newLayerId,
  newObjectId,
  newOperationId,
  newPrimitiveId,
  newProjectId,
} from './ids';

export {
  CoordinateSystemSchema,
  DisplayOverridesSchema,
  GridSchema,
  LayerSchema,
  LineTypeSchema,
  OperationSchema,
  OwnershipStateSchema,
  PrimitiveSchema,
  ProjectObjectSchema,
  ProjectSchema,
} from './schemas';

export { LoadFailure, deserialize, serialize } from './serialize';
