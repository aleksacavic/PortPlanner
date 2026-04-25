// Primitive CRUD actions per ADR-016.
// Each action goes through `emitOperation` (the transactional wrapper);
// direct store mutation is forbidden in this directory by Gate 6.5.

import type { Primitive, PrimitiveId } from '@portplanner/domain';

import { emitOperation } from '../operation-emit';

export function addPrimitive(primitive: Primitive): void {
  emitOperation({ type: 'CREATE', targetKind: 'primitive', targetId: primitive.id }, (state) => {
    if (!state.project) throw new Error('addPrimitive: no active project');
    state.project.primitives[primitive.id] = primitive;
  });
}

export function updatePrimitive(id: PrimitiveId, patch: Partial<Primitive>): void {
  emitOperation({ type: 'UPDATE', targetKind: 'primitive', targetId: id }, (state) => {
    if (!state.project) throw new Error('updatePrimitive: no active project');
    const existing = state.project.primitives[id];
    if (!existing) throw new Error(`updatePrimitive: primitive ${id} not found`);
    state.project.primitives[id] = { ...existing, ...patch } as Primitive;
  });
}

export function deletePrimitive(id: PrimitiveId): void {
  emitOperation({ type: 'DELETE', targetKind: 'primitive', targetId: id }, (state) => {
    if (!state.project) throw new Error('deletePrimitive: no active project');
    if (!state.project.primitives[id]) {
      throw new Error(`deletePrimitive: primitive ${id} not found`);
    }
    delete state.project.primitives[id];
  });
}
