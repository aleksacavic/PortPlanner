# Coordinate System Reference

See ADR-001 for the architectural decision. This document is the
implementation reference.

## The three coordinate systems

The platform uses three distinct coordinate systems. Each has a specific role
and transformations between them happen at defined boundaries.

### 1. Project-local metric coordinates

**Used for:** all engineering computation, all object geometry storage, all
distance and area calculations, all validation rules, all extraction formulas,
all 3D scene composition.

**Units:** metres.

**Origin:** defined per project. Stored in the project record.

**Axes:** X east, Y north, Z up (right-handed). Rotation from true north is
stored per project and applied when reporting bearings.

**Storage:** GeoJSON with coordinates as [x_metres, y_metres] in the
project-local system.

### 2. WGS84 geodetic coordinates

**Used for:** basemap alignment, import/export to external systems, GPS survey
data ingestion, API display.

**Units:** decimal degrees (latitude, longitude).

**Transformation:** converted from project-local using the project's origin
lat/lng, the local UTM zone, and the true north rotation. Conversion happens
at the API boundary.

**Storage:** only stored for the project origin. Individual objects are
converted on read if WGS84 is requested.

### 3. Screen pixel coordinates

**Used for:** rendering on the canvas, hit testing mouse position, drawing
interactions.

**Units:** CSS pixels.

**Transformation:** applied by the view layer. Never touches domain logic.

## The transformation chain

```
User clicks on canvas
  → pixel coords (view layer)
  → WGS84 (via map library)
  → project-local metres (at editor/API boundary)
  → stored on object geometry

Object rendered on canvas
  → project-local metres (from storage)
  → WGS84 (for map overlay) OR direct to screen (for local canvas)
  → pixel coords (via view transform)
  → drawn
```

## What crosses which boundary

| Concern | Coordinate system |
|---|---|
| Object geometry storage | Project-local |
| Geometric validation (distances, areas) | Project-local |
| Extraction formulas | Project-local |
| 3D scene composition | Project-local |
| Spatial database queries (PostGIS) | Project-local with optional WGS84 view |
| API request/response | Project-local by default, WGS84 on request |
| Map basemap display | WGS84 |
| Canvas rendering | Screen pixels (transformed from project-local) |

## Anti-patterns

**Never compute distances in WGS84.** A 0.0001 degree delta is not a constant
metric distance. Always transform to project-local first.

**Never compute distances in screen pixels and multiply by "metres per pixel".**
This approximation fails at project boundaries, under zoom, and for angled
geometry. Use project-local coordinates.

**Never store pixel-derived geometry.** Pixels change with zoom. The
authoritative geometry is the metric representation.

**Never do rotation math on geographic coordinates.** Transform to project-local,
rotate, transform back if needed.

## Implementation requirements

The coordinate system module must provide:

```typescript
interface ProjectCoordinateSystem {
  origin_lat: number;           // WGS84 latitude of project origin
  origin_lng: number;           // WGS84 longitude of project origin
  true_north_rotation: number;  // degrees, clockwise from grid north
  utm_zone: string;             // e.g. "40N" for Abu Dhabi
  
  toProjectLocal(lat: number, lng: number): Point2D;
  toWGS84(point: Point2D): LatLng;
  
  // For basemap integration
  projectLocalToMapPixel(point: Point2D, map: MapView): PixelPoint;
  mapPixelToProjectLocal(pixel: PixelPoint, map: MapView): Point2D;
}
```

All transformations are deterministic. Round-trip conversions must preserve
coordinates to within 1mm at project scales (up to 10km from origin).

## Project origin selection

For a new project, the origin is chosen by the user as a meaningful point on
the site — typically the site entrance, the planned gate location, or a
surveyed benchmark. The origin is immutable once set. Moving it would
invalidate all stored geometry.

If a project needs to be re-origined (rare), that is a deliberate operation
that transforms all stored geometry and is logged as a project-level event.
