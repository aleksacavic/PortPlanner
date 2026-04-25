// Grid CRUD actions per ADR-016.

import type { Grid, GridId } from '@portplanner/domain';

import { emitOperation } from '../operation-emit';

export function addGrid(grid: Grid): void {
  emitOperation({ type: 'CREATE', targetKind: 'grid', targetId: grid.id }, (state) => {
    if (!state.project) throw new Error('addGrid: no active project');
    state.project.grids[grid.id] = grid;
  });
}

export function updateGrid(id: GridId, patch: Partial<Grid>): void {
  emitOperation({ type: 'UPDATE', targetKind: 'grid', targetId: id }, (state) => {
    if (!state.project) throw new Error('updateGrid: no active project');
    const existing = state.project.grids[id];
    if (!existing) throw new Error(`updateGrid: grid ${id} not found`);
    state.project.grids[id] = { ...existing, ...patch } as Grid;
  });
}

export function deleteGrid(id: GridId): void {
  emitOperation({ type: 'DELETE', targetKind: 'grid', targetId: id }, (state) => {
    if (!state.project) throw new Error('deleteGrid: no active project');
    if (!state.project.grids[id]) throw new Error(`deleteGrid: grid ${id} not found`);
    delete state.project.grids[id];
  });
}
