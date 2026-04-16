# ADR-001 — Coordinate System Strategy

**Status:** ACCEPTED
**Date:** 2026-04-16

## Context

The system combines geospatial basemap display with precision engineering
geometry. Web Mercator screen coordinates distort distances and angles. Every
throughput calculation, costing formula, and constraint check must be
metrically accurate.

Port planners work with real dimensions: a 250m maximum RTG block length, a
6.0m minimum truck lane width, a 14m underkeel clearance. Computing any of
these in geographic or screen coordinates produces errors that compound across
the derivation pipeline.

## Options considered

**A. All geometry in WGS84 throughout.** Simple storage, but all engineering
math must convert to metric on every operation. Easy to get wrong. Distance
calculations between WGS84 points require proper geodesic math that is often
skipped in favour of approximations.

**B. All geometry in project-local metric plane. Basemap is a view-only
concern.** Engineering math is native and straightforward. Basemap integration
requires a transformation layer but only at the view boundary. WGS84 is used
for import/export and API display only.

**C. Dual storage: WGS84 for persistence, metric for computation.** Doubles
storage complexity, introduces synchronization concerns, creates opportunities
for the two representations to drift.

## Decision

**Option B.**

Every project stores a coordinate system record:

```typescript
interface ProjectCoordinateSystem {
  origin_lat: number;            // WGS84 latitude of project origin
  origin_lng: number;            // WGS84 longitude of project origin
  true_north_rotation: number;   // degrees clockwise from grid north
  utm_zone: string;              // e.g. "40N"
}
```

All element geometry is stored in project-local X/Y metres from the origin.
All engineering computation happens in this system. Conversion to WGS84
happens at the API boundary when needed for display or export.

PostGIS queries use a materialized WGS84 view for spatial indexing, but the
authoritative store is project-local metric.

## Consequences

- All geometric math — fillet radii, setback distances, block lengths — is
  metrically accurate and straightforward to implement.
- Basemap alignment is a display concern handled at the view layer.
- Adding raster reference layers (bathymetry, survey data) fits cleanly:
  rasters are registered against the project coordinate system at import.
- Origin is chosen at project creation and immutable. Moving it later would
  invalidate all stored geometry (rare, would be a deliberate transformation
  operation).
- Cross-project spatial queries require transformation through WGS84.

## What this makes harder

- Projects cannot silently share geometry without coordinate system alignment.
- If the origin is chosen poorly (too far from the main site), metric
  coordinates become large and lose floating point precision at the edges.
  Good default: require origin within 1km of the main drawing area.
- Users who think geographically (lat/lng) rather than metrically need
  conversion support in the UI.
