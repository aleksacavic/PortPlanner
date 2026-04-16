# BUILDING

**Version:** 1.0.0

A building footprint with vertical extent, roof configuration, and
construction class.

## Inputs

### Geometry

| Field | Type | Notes |
|---|---|---|
| `geometry.polygon` | Point2D[] | Closed polygon in project-local metric coords |

### Parameters

| Field | Type | Default | Notes |
|---|---|---|---|
| `building_type` | enum | `warehouse` | `warehouse` \| `admin` \| `canopy` \| `welfare` \| `workshop` \| `gatehouse` |
| `storeys` | integer | 1 | Number of storeys |
| `storey_height_m` | number | 6.0 | Height per storey (metres). For warehouses typical 8-12. |
| `roof_type` | enum | `flat` | `flat` \| `slope1` (hip) \| `slope2` (gable) |
| `roof_rise_m` | number | 3.0 | Peak rise above eave for sloped roofs |
| `construction_class` | enum | `permanent` | `permanent` \| `semi_permanent` \| `temporary` |

## Outputs

### QuantityBundle

| Field | Type | Unit | Formula |
|---|---|---|---|
| `footprint_area_m2` | number | m² | Polygon area |
| `gross_floor_area_m2` | number | m² | `footprint_area_m2 × storeys` |
| `total_height_m` | number | m | `storeys × storey_height_m + (roof_rise_m if sloped)` |
| `volume_m3` | number | m³ | See roof-specific formulas below |
| `perimeter_m` | number | m | Polygon perimeter |
| `roof_area_m2` | number | m² | See roof-specific formulas below |
| `facade_area_m2` | number | m² | `perimeter_m × (storeys × storey_height_m)` |

### Roof-specific formulas

**Flat roof:**
```
roof_area_m2 = footprint_area_m2
volume_m3 = footprint_area_m2 × storeys × storey_height_m
```

**Hip roof (slope1):**
```
roof_area_m2 = footprint_area_m2 × 1.15   (approximation)
volume_m3 = footprint_area_m2 × storeys × storey_height_m
           + footprint_area_m2 × roof_rise_m × (1/3)
```

**Gable roof (slope2):**
```
roof_area_m2 = footprint_area_m2 × 1.12   (approximation)
volume_m3 = footprint_area_m2 × storeys × storey_height_m
           + footprint_area_m2 × roof_rise_m × (1/2)
```

## Validation rules

| Rule ID | Scope | Severity | Condition |
|---|---|---|---|
| `BUILDING_IN_SETBACK` | RELATIONSHIP | ERROR | Footprint closer than site setback to boundary |
| `BUILDING_BLOCKS_CIRCULATION` | RELATIONSHIP | ERROR | Footprint intersects road or truck lane |
| `BUILDING_OVERLAPS_STACK` | RELATIONSHIP | ERROR | Footprint intersects RTG_BLOCK zone |
| `BUILDING_STOREY_HEIGHT_MIN` | OBJECT | WARNING | `storey_height_m < 3.0` (implausible) |
| `BUILDING_FOOTPRINT_MIN` | OBJECT | WARNING | `footprint_area_m2 < 20` (implausibly small) |
| `WAREHOUSE_COLUMN_GRID` | OBJECT | INFO | Footprint dimensions not aligned with standard column grid (6m/8m/12m module) |

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-16 | Initial specification |
