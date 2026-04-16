# RTG_BLOCK

**Version:** 1.0.0

A rubber-tyred gantry container stack block. The primary storage element in
a container terminal yard.

## Inputs

### Geometry

| Field | Type | Notes |
|---|---|---|
| `geometry.length_m` | number | Along the bay axis (RTG travel direction) |
| `geometry.width_m` | number | Across bay, derived from zone configuration |
| `geometry.bay_axis_p1` | Point2D | Project-local metric start of bay axis |
| `geometry.bay_axis_p2` | Point2D | Project-local metric end of bay axis |

### Parameters

| Field | Type | Default | Notes |
|---|---|---|---|
| `containers_wide` | integer | 6 | Number of container columns across bay (nw). Valid: 5, 6, 7 |
| `stack_height` | integer | 5 | Containers in vertical stack (nh). Valid: 4, 5, 6 |
| `rows` | integer | 1 | Single (1) or back-to-back (2) |
| `rtg_type` | enum | `cantilever` | `cantilever` \| `portal` |
| `leg_strip_m` | number | 1.2 | RTG leg provision width (metres) |
| `truck_lane_m` | number | 6.0 | Truck lane width (metres) |
| `container_length_m` | number | 6.058 | CL_M, ISO 20ft container length |
| `container_width_m` | number | 2.438 | CW_M, ISO 20ft container width |
| `container_height_m` | number | 2.591 | CH_M, ISO 20ft container height |
| `rtg_spacing_m` | number | 60.0 | Along-bay spacing between RTG positions |

## Outputs

### QuantityBundle

| Field | Type | Unit | Formula |
|---|---|---|---|
| `teu_slots` | number | TEU | `floor(length_m / container_length_m) × containers_wide × rows` |
| `stack_capacity_teu` | number | TEU | `teu_slots × stack_height` |
| `gross_area_m2` | number | m² | `length_m × cross_section_width_m` |
| `net_container_area_m2` | number | m² | `length_m × (rows × containers_wide × container_width_m)` |
| `truck_lane_length_m` | number | m | `length_m` (one-sided truck lane) |
| `rtg_count` | number | units | `ceil(length_m / rtg_spacing_m)` |
| `crane_positions` | number | positions | `rtg_count × 2` |
| `cross_section_width_m` | number | m | Computed from zone layout (see below) |
| `clearance_height_m` | number | m | `(stack_height + 1) × container_height_m + 2.0` |

### Cross-section width computation

For `rtg_type = cantilever`:

```
cross_section_width_m =
  truck_lane_m
  + leg_strip_m
  + (rows × containers_wide × container_width_m)
  + leg_strip_m
```

For `rtg_type = portal`:

```
cross_section_width_m =
  leg_strip_m
  + truck_lane_m
  + (rows × containers_wide × container_width_m)
  + leg_strip_m
```

## Validation rules

| Rule ID | Scope | Severity | Condition |
|---|---|---|---|
| `RTG_BLOCK_LENGTH_MAX` | OBJECT | WARNING | `length_m > 250` |
| `RTG_BLOCK_LENGTH_MIN` | OBJECT | WARNING | `length_m < 50` |
| `RTG_BLOCK_CLEARANCE_HEIGHT` | OBJECT | ERROR | `clearance_height_m < adjacent_obstacle_height` |
| `RTG_BLOCK_TRUCK_LANE_MIN` | OBJECT | ERROR | `truck_lane_m < 6.0` |
| `RTG_BLOCK_LEG_STRIP_MIN` | OBJECT | ERROR | `leg_strip_m < 0.8` |
| `RTG_BLOCK_SPAN_CHECK` | OBJECT | WARNING | Cross-section span exceeds manufacturer max |

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-16 | Initial specification |
