// M1.3b simple-transforms Phase 1 — barrel re-exports for the 4
// per-primitive transform helpers. Pure domain functions; consumers
// (editor-2d tools + previewBuilders) import from
// `@portplanner/domain` (the package barrel re-exports this module).

export { mirrorPrimitive } from './mirror';
export { offsetPrimitive } from './offset';
export { rotatePrimitive } from './rotate';
export { scalePrimitive } from './scale';

// M1.3b fillet-chamfer Phase 1 — fillet + chamfer per-pair-type helpers.
export {
  filletLineAndPolylineEndpoint,
  filletPolylineCorner,
  filletTwoLines,
  type FilletArcGeometry,
  type FilletLinePolylineResult,
  type FilletTwoLinesResult,
} from './fillet';
export {
  chamferLineAndPolylineEndpoint,
  chamferPolylineCorner,
  chamferTwoLines,
  type ChamferLinePolylineResult,
  type ChamferSegmentGeometry,
  type ChamferTwoLinesResult,
} from './chamfer';
