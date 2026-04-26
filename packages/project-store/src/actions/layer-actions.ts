// Layer CRUD actions per ADR-017.
// Default layer cannot be deleted or renamed (I-13 + I-15).
// Deleting a layer with referenced entities requires reassignTo.

import { type Layer, type LayerId, LayerId as LayerIdNs } from '@portplanner/domain';

import { emitOperation } from '../operation-emit';
import { projectStore } from '../store';

export function addLayer(layer: Layer): void {
  emitOperation({ type: 'CREATE', targetKind: 'layer', targetId: layer.id }, (state) => {
    if (!state.project) throw new Error('addLayer: no active project');
    state.project.layers[layer.id] = layer;
  });
}

export function updateLayer(id: LayerId, patch: Partial<Layer>): void {
  if (id === LayerIdNs.DEFAULT && patch.name !== undefined && patch.name !== '0') {
    throw new Error('updateLayer: cannot rename the protected default layer');
  }
  emitOperation({ type: 'UPDATE', targetKind: 'layer', targetId: id }, (state) => {
    if (!state.project) throw new Error('updateLayer: no active project');
    const existing = state.project.layers[id];
    if (!existing) throw new Error(`updateLayer: layer ${id} not found`);
    state.project.layers[id] = { ...existing, ...patch } as Layer;
  });
}

export function deleteLayer(id: LayerId, opts?: { reassignTo?: LayerId }): void {
  if (id === LayerIdNs.DEFAULT) {
    throw new Error('deleteLayer: cannot delete the protected default layer');
  }
  const project = projectStore.getState().project;
  if (!project) throw new Error('deleteLayer: no active project');
  if (!project.layers[id]) throw new Error(`deleteLayer: layer ${id} not found`);

  // Check for references in primitives, grids, and objects.
  const referenced =
    Object.values(project.primitives).some((p) => p.layerId === id) ||
    Object.values(project.grids).some((g) => g.layerId === id) ||
    Object.values(project.objects).some((o) => o.layerId === id);

  if (referenced) {
    if (!opts?.reassignTo) {
      throw new Error(
        `deleteLayer: layer ${id} has referencing entities; pass { reassignTo: LayerId }`,
      );
    }
    const target = opts.reassignTo;
    if (!project.layers[target]) {
      throw new Error(`deleteLayer: reassignTo target ${target} does not exist`);
    }
    // Reassign FIRST as a separate UPDATE op-cluster on each entity, then delete.
    // For simplicity in M1.3a we fold reassignment + delete into the DELETE op
    // mutator; downstream sync (M2+) may want per-entity ops here.
    emitOperation({ type: 'DELETE', targetKind: 'layer', targetId: id }, (state) => {
      if (!state.project) return;
      for (const pid of Object.keys(state.project.primitives)) {
        if (state.project.primitives[pid as never]?.layerId === id) {
          state.project.primitives[pid as never] = {
            ...state.project.primitives[pid as never]!,
            layerId: target,
          };
        }
      }
      for (const gid of Object.keys(state.project.grids)) {
        if (state.project.grids[gid as never]?.layerId === id) {
          state.project.grids[gid as never] = {
            ...state.project.grids[gid as never]!,
            layerId: target,
          };
        }
      }
      for (const oid of Object.keys(state.project.objects)) {
        if (state.project.objects[oid as never]?.layerId === id) {
          state.project.objects[oid as never] = {
            ...state.project.objects[oid as never]!,
            layerId: target,
          };
        }
      }
      delete state.project.layers[id];
    });
    return;
  }

  emitOperation({ type: 'DELETE', targetKind: 'layer', targetId: id }, (state) => {
    if (!state.project) return;
    delete state.project.layers[id];
  });
}
