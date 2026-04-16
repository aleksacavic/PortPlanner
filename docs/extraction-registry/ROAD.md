# ROAD

**Version:** 1.0.0

A linear road segment with lane configuration. May have fillets at vertices
to represent real-world corner radii.

## Inputs

### Geometry

| Field | Type | Notes |
|---|---|---|
| `geometry.polyline` | Point2D[] | Vertex list in project-local metric coords |
| `geometry.length_m` | number | Computed from polyline, includes fillet arcs |
| `geometry.fillets` | number[] | Fillet radius per vertex (0 = no fillet) |

### Parameters

| Field | Type | Default | Notes |
|---|---|---|---|
| `direction` | integer | 2 | 1 = one-way, 2 = two-way |
| `lanes_per_dir` | integer | 1 | Lanes per direction |
| `lane_width_m` | number | 3.75 | Width of a single lane |
| `shoulder_m` | number | 0 | Shoulder width each side |
| `surface_type` | enum | `medium_duty` | `heavy_duty` \| `medium_duty` \| `light_duty` |
| `design_speed_kmh` | number | 30 | Design speed for port internal roads |

## Outputs

### QuantityBundle

| Field | Type | Unit | Formula |
|---|---|---|---|
| `total_width_m` | number | m | `direction × lanes_per_dir × lane_width_m + 2 × shoulder_m` |
| `carriageway_area_m2` | number | m² | `length_m × total_width_m` |
| `pavement_area_m2` | number | m² | Same as carriageway_area_m2 |
| `centreline_length_m` | number | m | `length_m` |
| `lane_km` | number | lane-km | `length_m × direction × lanes_per_dir / 1000` |
| `kerb_length_m` | number | m | `2 × length_m` |
| `marking_length_m` | number | m | Centreline + lane dividers × length_m |

### Marking length computation

For two-way with N lanes per direction:
- Centreline (double yellow): counts as 1 × length
- Lane dividers: `(lanes_per_dir - 1) × 2` dividers × length_m
- Edge lines: `2 × length_m`

For one-way with N lanes:
- Lane dividers: `(lanes_per_dir - 1) × length_m`
- Edge lines: `2 × length_m`

## Validation rules

| Rule ID | Scope | Severity | Condition |
|---|---|---|---|
| `ROAD_LANE_WIDTH_MIN` | OBJECT | ERROR | `lane_width_m < 3.0` |
| `ROAD_LANE_WIDTH_HEAVY` | OBJECT | WARNING | `classification = HEAVY_VEHICLE ∧ lane_width_m < 3.75` |
| `ROAD_GATE_APPROACH_WIDTH` | OBJECT | ERROR | `classification = GATE_APPROACH ∧ total_width_m / direction < 6.0` |
| `ROAD_INTERSECTION_ANGLE` | RELATIONSHIP | WARNING | Joins another road at angle < 20° |
| `ROAD_IN_STACK_ZONE` | RELATIONSHIP | ERROR | Centreline passes through RTG_BLOCK |
| `ROAD_FILLET_RADIUS_MIN` | OBJECT | WARNING | Fillet radius < design_speed-based minimum |

### Design-speed-based fillet minimum

| Design speed (kmh) | Min fillet radius (m) |
|---|---|
| ≤ 15 | 5 |
| ≤ 30 | 15 |
| ≤ 50 | 40 |
| > 50 | 80 |

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-16 | Initial specification |
