# PAVEMENT_AREA

**Version:** 1.0.0

A paved surface polygon. Distinct from ROAD — represents open paved areas
such as container yard pavement, parking, marshalling areas.

## Inputs

### Geometry

| Field | Type | Notes |
|---|---|---|
| `geometry.polygon` | Point2D[] | Closed polygon in project-local metric coords |

### Parameters

| Field | Type | Default | Notes |
|---|---|---|---|
| `pavement_type` | enum | `medium_duty` | `heavy_duty` \| `medium_duty` \| `light_duty` \| `paved` |
| `thickness_mm` | number | 300 | Total pavement thickness (construction + surfacing) |
| `subgrade_cbr` | number | null | California Bearing Ratio (ground conditions). Optional. |

## Outputs

### QuantityBundle

| Field | Type | Unit | Formula |
|---|---|---|---|
| `gross_area_m2` | number | m² | Polygon area |
| `perimeter_m` | number | m | Polygon perimeter |
| `volume_m3` | number | m³ | `gross_area_m2 × thickness_mm / 1000` |

## Validation rules

| Rule ID | Scope | Severity | Condition |
|---|---|---|---|
| `PAVEMENT_TYPE_VEHICLE_MISMATCH` | RELATIONSHIP | ERROR | Heavy vehicle route over `light_duty` pavement |
| `PAVEMENT_OVERLAPS_BUILDING` | RELATIONSHIP | WARNING | Pavement polygon overlaps building footprint |
| `PAVEMENT_OVERLAPS_STACK` | RELATIONSHIP | INFO | Pavement polygon inside RTG_BLOCK zone (often intentional — ground slab) |
| `PAVEMENT_THICKNESS_VS_TYPE` | OBJECT | WARNING | Thickness below recommended minimum for pavement_type |

### Recommended minimum thickness per type

| Pavement type | Min thickness (mm) |
|---|---|
| `heavy_duty` | 400 |
| `medium_duty` | 300 |
| `light_duty` | 200 |
| `paved` | 150 |

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-04-16 | Initial specification |
