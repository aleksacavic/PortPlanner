// UUIDv7 generators + branded id types per ADR-012 decision #10.
// UUIDv7 IDs are time-ordered — they sort lexicographically by
// creation time, which gives free index locality in Postgres and
// in-memory maps.

import { v7 as uuidv7 } from 'uuid';

// Branded id types — nominal typing via phantom property.

export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type ObjectId = string & { readonly __brand: 'ObjectId' };
export type OperationId = string & { readonly __brand: 'OperationId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type PrimitiveId = string & { readonly __brand: 'PrimitiveId' };
export type LayerId = string & { readonly __brand: 'LayerId' };
export type GridId = string & { readonly __brand: 'GridId' };

export function newProjectId(): ProjectId {
  return uuidv7() as ProjectId;
}

export function newObjectId(): ObjectId {
  return uuidv7() as ObjectId;
}

export function newOperationId(): OperationId {
  return uuidv7() as OperationId;
}

export function newPrimitiveId(): PrimitiveId {
  return uuidv7() as PrimitiveId;
}

export function newLayerId(): LayerId {
  return uuidv7() as LayerId;
}

export function newGridId(): GridId {
  return uuidv7() as GridId;
}

// Fixed default-layer UUIDv7 — every project's protected default layer
// uses this exact id (per ADR-017 + M1.3a plan §A15). Same value across
// all projects so cross-project layer references are unambiguous.
// Type + value declaration merging gives consumers `LayerId.DEFAULT`.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const LayerId = {
  DEFAULT: '01900000-0000-7000-8000-000000000000' as LayerId,
} as const;

/**
 * Fixed placeholder UUID used for `Operation.userId` in M1 (auth is
 * excluded from M1 per `docs/execution-plan.md`; real user ids land
 * when auth ships in M3+). ADR-010 requires `user_id: UUID`; this
 * sentinel satisfies the type contract and is distinguishable in
 * post-auth data-mining.
 */
export const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000000' as UserId;

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns true iff the given string is a well-formed UUIDv7. */
export function isUUIDv7(value: string): boolean {
  return UUID_V7_REGEX.test(value);
}
