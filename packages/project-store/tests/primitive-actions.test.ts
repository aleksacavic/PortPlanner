import {
  LayerId,
  type Project,
  defaultLayer,
  newPrimitiveId,
  newProjectId,
} from '@portplanner/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNewProject } from '../src/actions';
import { addPrimitive, deletePrimitive, updatePrimitive } from '../src/actions/primitive-actions';
import { getOperationLog } from '../src/operation-emit';
import { projectStore } from '../src/store';
import { resetProjectStoreForTests } from '../src/test-utils';

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.2.0',
    name: 'Test',
    createdAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-25T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives: {},
    layers: { [LayerId.DEFAULT]: defaultLayer() },
    grids: {},
    scenarioId: null,
  };
}

describe('primitive actions + emitOperation', () => {
  beforeEach(() => {
    createNewProject(makeProject());
  });
  afterEach(() => {
    resetProjectStoreForTests();
  });

  it('addPrimitive(line) adds it to the project and emits a CREATE op', () => {
    const id = newPrimitiveId();
    addPrimitive({
      id,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    expect(projectStore.getState().project?.primitives[id]).toBeDefined();
    const ops = getOperationLog();
    const created = ops.filter((o) => o.targetKind === 'primitive' && o.type === 'CREATE');
    expect(created).toHaveLength(1);
    expect(created[0]?.before).toBeNull();
    expect(created[0]?.after?.kind).toBe('primitive');
  });

  it('updatePrimitive emits an UPDATE op with before+after snapshots', () => {
    const id = newPrimitiveId();
    addPrimitive({
      id,
      kind: 'circle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      center: { x: 0, y: 0 },
      radius: 5,
    });
    updatePrimitive(id, { kind: 'circle', center: { x: 0, y: 0 }, radius: 10 } as never);
    const ops = getOperationLog();
    const updates = ops.filter((o) => o.type === 'UPDATE');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.before).not.toBeNull();
    expect(updates[0]?.after).not.toBeNull();
  });

  it('deletePrimitive removes from store and emits DELETE op', () => {
    const id = newPrimitiveId();
    addPrimitive({
      id,
      kind: 'point',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      position: { x: 0, y: 0 },
    });
    deletePrimitive(id);
    expect(projectStore.getState().project?.primitives[id]).toBeUndefined();
    const ops = getOperationLog();
    const deletes = ops.filter((o) => o.type === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.before).not.toBeNull();
    expect(deletes[0]?.after).toBeNull();
  });

  it('Operation.sequence is monotonically increasing', () => {
    const ids = [newPrimitiveId(), newPrimitiveId(), newPrimitiveId()];
    for (const id of ids) {
      addPrimitive({
        id,
        kind: 'point',
        layerId: LayerId.DEFAULT,
        displayOverrides: {},
        position: { x: 0, y: 0 },
      });
    }
    const seq = getOperationLog().map((o) => o.sequence);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThan(seq[i - 1]!);
    }
  });

  it('promotionGroupId is omitted by default in M1.3a', () => {
    const id = newPrimitiveId();
    addPrimitive({
      id,
      kind: 'point',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      position: { x: 0, y: 0 },
    });
    const op = getOperationLog().find((o) => o.targetId === id);
    expect(op?.promotionGroupId).toBeUndefined();
  });
});
