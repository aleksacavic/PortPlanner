# ADR-008 — 3D Derivation Cache

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

The 3D viewer is a derived view of the authoritative 2D document. Rebuilding
all geometry on every tab switch is wasteful — a large port project has
hundreds of objects and thousands of mesh primitives.

Storing Three.js scene objects as the primary cache unit is renderer-specific
and fragile. A scene is stateful and holds references to materials, lights,
and camera state that do not travel cleanly.

## Options considered

**A. Full rebuild on every 3D tab open.** Simple. Wasteful. Bad UX for tab
switching.

**B. Cache complete Three.js scene in memory.** Fast on re-entry. Fragile
(renderer-specific). Does not support partial invalidation. Does not survive
renderer library upgrades cleanly.

**C. Cache geometry buffers and material descriptors per object. Recompose
the scene cheaply on each view activation.** Granular invalidation. Renderer
upgrades are tractable. Scene composition is fast (sub-100ms for typical
projects).

## Decision

**Option C.**

Per-object mesh descriptor:

```typescript
interface ObjectMeshDescriptor {
  object_id: UUID;
  geometry_fingerprint: string;        // hash of inputs

  // Cached geometry buffers (renderer-neutral)
  vertex_buffer: Float32Array;
  index_buffer: Uint32Array;
  normal_buffer: Float32Array;
  uv_buffer: Float32Array | null;

  // Material reference
  material_key: string;                // keyed into material registry

  // Scene placement
  transform: Matrix4;
  bounding_box: BoundingBox;

  cached_at: timestamp;
}
```

**Fingerprint definition:**

```
geometry_fingerprint = hash(
  object_id,
  object_geometry_wkt,
  JSON.stringify(object_parameters_sorted),
  RENDER_VERSION
)
```

`RENDER_VERSION` is a module-level constant that is bumped when the 3D
generation code changes. Bumping it forces all cached descriptors to
regenerate on next use.

**Cache layer:** in-memory Map keyed by `object_id`. No DB persistence of
mesh data (it is cheap to regenerate and expensive to migrate across
renderer versions). On page reload, the cache is cold and rebuilds on first
3D view activation.

**Scene composition on view activation:**
1. For each object in the current project + scenario, check the cache.
2. If the fingerprint matches, reuse the cached descriptor.
3. If absent or fingerprint mismatch, regenerate and cache.
4. Compose the Three.js scene from descriptors (cheap — just instancing and
   transform application).

## Consequences

- Moving the camera or toggling visibility layers costs nothing.
- Editing one object invalidates only that object's mesh descriptor.
- Renderer-agnostic: descriptors could feed Three.js, Babylon.js, or a
  future WebGPU renderer. Switching renderers does not require a data
  migration.
- `RENDER_VERSION` gives a clean upgrade path for rendering improvements.
- Scene composition is fast because it is just instancing precomputed
  buffers.

## What this makes harder

- Must maintain the fingerprint function as a stable contract. Changing
  what inputs affect the fingerprint requires care.
- Memory usage is per-object. Very large projects (thousands of objects)
  need an LRU eviction policy on the cache. Out of scope for V1.
- Cross-object effects (e.g. shadow casting, reflections) are not
  captured in per-object descriptors. These are scene-composition concerns
  handled when composing, not cached.
