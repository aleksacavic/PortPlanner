// @portplanner/project-store — vanilla Zustand store + actions.
// No React. Canvas paint loops / 3D scene loops / tests / workers
// import from here directly. React components use @portplanner/
// project-store-react hooks instead.

export { type ProjectStoreState, createInitialProjectStoreState } from './initial-state';
export { projectStore } from './store';
export { createNewProject, hydrateProject, markSaved } from './actions';
export { addPrimitive, deletePrimitive, updatePrimitive } from './actions/primitive-actions';
export { addLayer, deleteLayer, updateLayer } from './actions/layer-actions';
export { addGrid, deleteGrid, updateGrid } from './actions/grid-actions';
export { clearOperationLog, emitOperation, getOperationLog } from './operation-emit';
export { resetProjectStoreForTests } from './test-utils';
