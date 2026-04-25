// Operation emission helper per ADR-020 — resolves M1.2 PI-1.
//
// `emitOperation(meta, mutator)` is a transactional wrapper:
//   1. capture before-snapshot (via targetKind-discriminated lookup)
//   2. apply the mutator inside projectStore.setState
//   3. capture after-snapshot
//   4. construct an Operation, push to in-memory log, return it
//
// Entity-level actions under packages/project-store/src/actions/ MUST
// go through this helper; direct projectStore.setState calls in
// actions/ are forbidden by Gate 6.5 (Codex Round-1 OI-2a hardening).
//
// Op-log persistence is deferred per ADR-014 M1 scope; this log is
// in-memory, feeds zundo via temporal middleware (which already
// captures project-slice state), and is discarded on reload.

import {
  LOCAL_USER_ID,
  type Operation,
  type OperationType,
  type ProjectId,
  type TargetKind,
  type TargetSnapshot,
  newOperationId,
} from '@portplanner/domain';

import { type ProjectStoreState } from './initial-state';
import { projectStore } from './store';

interface OperationMeta {
  type: OperationType;
  targetKind: TargetKind;
  targetId: string;
  promotionGroupId?: string;
}

let operationLog: Operation[] = [];
let sequenceCounter = 0;

/**
 * Build a TargetSnapshot for the given kind by reading the matching
 * map from project state. Returns `null` when the entity is absent
 * (e.g., before-snapshot on CREATE, after-snapshot on DELETE).
 */
function readSnapshot(
  state: ProjectStoreState,
  targetKind: TargetKind,
  targetId: string,
): TargetSnapshot | null {
  if (!state.project) return null;
  switch (targetKind) {
    case 'object': {
      const o = state.project.objects[targetId as never];
      return o ? { kind: 'object', snapshot: o } : null;
    }
    case 'primitive': {
      const p = state.project.primitives[targetId as never];
      return p ? { kind: 'primitive', snapshot: p } : null;
    }
    case 'layer': {
      const l = state.project.layers[targetId as never];
      return l ? { kind: 'layer', snapshot: l } : null;
    }
    case 'grid': {
      const g = state.project.grids[targetId as never];
      return g ? { kind: 'grid', snapshot: g } : null;
    }
    case 'dimension':
      // Dimension arm is reserved (M1.3c). M1.3a producers do not emit
      // dimension ops. Returning null here is unreachable in practice.
      return null;
  }
}

export function emitOperation(
  meta: OperationMeta,
  mutator: (state: ProjectStoreState) => void,
): Operation {
  const stateBefore = projectStore.getState();
  if (!stateBefore.project) {
    throw new Error(
      `emitOperation: cannot emit '${meta.type} ${meta.targetKind}' without an active project`,
    );
  }
  const before = readSnapshot(stateBefore, meta.targetKind, meta.targetId);

  projectStore.setState((draft) => {
    mutator(draft);
    draft.dirty = true;
  });

  const stateAfter = projectStore.getState();
  const after = readSnapshot(stateAfter, meta.targetKind, meta.targetId);

  sequenceCounter += 1;
  const op: Operation = {
    id: newOperationId(),
    projectId: stateAfter.project!.id as ProjectId,
    sequence: sequenceCounter,
    timestamp: new Date().toISOString(),
    userId: LOCAL_USER_ID,
    type: meta.type,
    targetKind: meta.targetKind,
    targetId: meta.targetId,
    before,
    after,
    ...(meta.promotionGroupId === undefined ? {} : { promotionGroupId: meta.promotionGroupId }),
  };
  operationLog.push(op);
  return op;
}

export function getOperationLog(): readonly Operation[] {
  return operationLog;
}

export function clearOperationLog(): void {
  operationLog = [];
  sequenceCounter = 0;
}
